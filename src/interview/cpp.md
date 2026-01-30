---
title: cpp知识
icon: code-xml
---

---
# thread_local 关键字

```cpp
size_t write(cosnt StringViewRange auto&& buffers) {
	static thread_local std::vector<iovec> iovecs;
	// buffer -> iovecs
	return write(iovecs, total_size);
}
```

```
[线程 A 的内存视角]
+---------------------+
| 寄存器 fs           | ---> 指向 TLS 区域
+---------------------+
| TLS 区域 (Thread Local Storage)
| [ iovecs_A (24字节) ] --------+
+---------------------+         | 指针指向
                                v
                      +--------------------------+
                      | 堆 (Heap)                |
                      | [ iovec, iovec, ... ]    | <--- 这里的内存被反复利用
                      +--------------------------+

-------------------------------------------------------

[线程 B 的内存视角]
+---------------------+
| 寄存器 fs           | ---> 指向 线程 B 自己的 TLS
+---------------------+
| TLS 区域
| [ iovecs_B (24字节) ] --------+
+---------------------+         | 指针指向不同的堆地址
                                v
                      +--------------------------+
                      | 堆 (Heap)                |
                      | [ iovec, iovec, ... ]    |
                      +--------------------------+
```

**类（Class）没有线程，只有操作系统（OS）有线程。**
- **错误理解**：每一个 FileDescriptor 对象都有一个线程
- **正确理解**：你的程序可能启动了 10 个线程，这 10 个线程可能会操作同一个 FileDescriptor 对象，也可能操作 1000 个不同的 FileDescriptor 对象。
**static thread_local 的含义是：**  
不管你创建了多少个 FileDescriptor 对象（哪怕 1 万个），**只要它们是在同一个线程（Thread A）里运行的 write 函数，它们就共享同一个 iovecs 变量。**
- **场景 1**：线程 A 里的 socket1 调了 write，接着 socket2 也调了 write。
    - 结果：socket2 会**复用** socket1 刚刚用过的那块内存（前提是 socket1 用完后 vector 被 clear 了，但 capacity 还在）。效率极高！
- **场景 2**：线程 A 里的 socket1 和线程 B 里的 socket1 同时调 write。
    - 结果：线程 A 用的是 iovecs_A，线程 B 用的是 iovecs_B。互不干扰，不需要加锁。


- **出生（构造）**：
    - 当**某个线程第一次**运行到 write 函数内部的那一行代码时，这个线程专属的 iovecs 被构造。
    - 如果你有 10 个线程，但只有 3 个线程调用过 write，那就只有 3 个 iovecs 被创建。
- **存活**：
    - 只要这个**线程**还活着，这个变量就一直活着（保留着堆内存）。
    - 它**不随对象的销毁而销毁**。即使你把所有的 FileDescriptor 对象都析构了，只要线程还在，这个 iovecs 依然占着内存等待下一次召唤。
- **死亡（析构）**：
    - 当**线程退出（Thread Exit）** 时。
    - C++ 运行时环境会自动遍历该线程所有的 thread_local 变量，调用它们的析构函数，从而释放那块堆内存，最后清理 TLS 里的头信息。
###  static 是什么意思？（在函数内部）

当 static 用于函数内部的局部变量时，它改变的是变量的 **生命周期（Lifecycle）** 和 **存储位置**。
- **普通局部变量** (int a = 0;)
    - **存储位置**：栈（Stack）。
    - **生命周期**：函数被调用时创建，函数返回时销毁。下次调用时是全新的。
    - **比喻**：便利贴。用完就撕了扔掉。
- **静态局部变量** (static int a = 0;)：
    - **存储位置**：数据段（Data Segment / BSS）。
    - **生命周期**：**整个程序运行期间**。它在程序第一次运行到这行代码时初始化，直到程序结束才销毁。
    - **比喻**：墙上的白板。你写了字，离开房间再回来，字还在那里。
        

---

###  thread_local 是什么意思？
它改变的是变量的 **实例数量** 和 **归属权**。
- **没有 thread_local**：
    - 全局只有一份（如果是 static）。所有线程看到的都是同一个变量，改的也是同一个。
    - **后果**：多线程同时改会打架（Data Race），必须加锁。
- **有 thread_local**：
    - 每个线程都有一份独立的拷贝。
    - **生命周期**：**与线程绑定**。线程启动（或第一次使用）时创建，线程结束时销毁。
        

---


# `std::unique_ptr<> std::make_unique<>()`

1. **`std::unique_ptr` (霸道总裁)**：
    - 它是**管理者**。
    - 它的座右铭是：“**这块内存是我的，只能是我的，谁也别想复制，但我死了这块内存也别想活。**”
    - 它通过 RAII（资源获取即初始化）机制，保证出了作用域自动释放内存。
2. **`std::make_unique` (专属工厂)**：
    - 它是**生产者**。
    - 它的作用是：“**别自己瞎折腾去 new 了，把要求告诉我，我帮你造好打包送给你。**”
    - 它是 C++14 引入的辅助函数，用来生成 `unique_ptr`。
独占所有权->不能拷贝 只能移动
零开销
- unique_ptr 内部只存了一个裸指针。
- 如果你不使用自定义删除器（Deleter），它的大小和 int* 完全一样（64位系统下就是 8 字节）。
- 它的解引用操作 \*ptr 和 ptr-> 会被编译器优化成和裸指针一模一样的汇编指令

```cpp
process(std::unique_ptr<A>(new A()), std::unique_ptr<B>(new B()));
```
C++ 编译器在编译这行代码时，执行顺序是不确定的（Unspecified Evaluation Order）。它可能这样执行：
1. new A() 分配成功。
2. **执行 new B() —— 此时内存不足抛出异常！**
3. `std::unique_ptr<A>` 的构造函数还没来得及执行。
4. **结果**：A 的指针丢失了，没人负责 delete 它，**内存泄漏**。
```cpp
process(std::make_unique<A>(), std::make_unique<B>());
```


make_unique 内部封装了 new 和 unique_ptr 的构造。它是一个完整的函数调用。  
这意味着步骤变成了：
1. 完整执行 `make_unique<A>()`（分配+包装）。成功后返回一个对象。
2. 完整执行 `make_unique<B>()`。
3. **如果 B 失败了，A 已经是一个智能指针对象了，它会自动析构释放内存。**
4. **结论：零泄漏风险。**

# 使用工厂函数
```cpp
// 方式1：不使用工厂函数（复杂）
class Value {
public:
    Value(TypeId type, int32_t value) : type_(type), value_(value) {}
    Value(TypeId type, const std::string& value) : type_(type) {
        // 复杂的字符串处理逻辑
        // 内存管理逻辑
        // ...
    }
    Value(TypeId type, bool value) : type_(type), value_(static_cast<int8_t>(value)) {}
};

// 使用时需要记住复杂的构造方式
Value int_val(TypeId::INTEGER, 42);
Value bool_val(TypeId::BOOLEAN, static_cast<int8_t>(true));  // 需要手动转换

// 方式2：使用工厂函数（简洁）
class ValueFactory {
public:
    static inline auto GetIntegerValue(int32_t value) -> Value {
        return {TypeId::INTEGER, value};
    }
    
    static inline auto GetBooleanValue(bool value) -> Value {
        return {TypeId::BOOLEAN, static_cast<int8_t>(value)};
    }
};

// 使用时非常简单直观
Value int_val = ValueFactory::GetIntegerValue(42);
Value bool_val = ValueFactory::GetBooleanValue(true);
```
工厂函数一般都使用static 因为这样函数只属于这个工厂类本身 不需要实例化一个ValueFactory对象 能够直接通过这个类名进行调用 而且可以在全局范围内进行访问
优点
- 能够统一接口
- 易于扩展 如果需要支持新的类别的话 直接在工厂中添加新方法即可
- 隐藏复杂度

```cpp
class GameObject {
protected:
    GameObject(const std::string& type, int x, int y) : type_(type), x_(x), y_(y) {}
    
public:
    static std::unique_ptr<GameObject> CreatePlayer(int x, int y) {
        auto player = std::unique_ptr<GameObject>(new GameObject("player", x, y));
        player->setHealth(100);
        player->setSpeed(5);
        return player;
    }
    
    static std::unique_ptr<GameObject> CreateEnemy(int x, int y) {
        auto enemy = std::unique_ptr<GameObject>(new GameObject("enemy", x, y));
        enemy->setHealth(50);
        enemy->setSpeed(3);
        enemy->setAggressive(true);
        return enemy;
    }
    
    static std::unique_ptr<GameObject> CreateItem(int x, int y, const std::string& itemType) {
        auto item = std::unique_ptr<GameObject>(new GameObject("item", x, y));
        item->setItemProperties(itemType);
        return item;
    }
};

// 使用
auto player = GameObject::CreatePlayer(0, 0);
auto enemy = GameObject::CreateEnemy(100, 100);
auto potion = GameObject::CreateItem(50, 50, "health_potion");
```
例如这里都是创建游戏中的对象 可以使用工厂函数 更加简单直观地进行构造