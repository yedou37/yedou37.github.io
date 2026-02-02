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





# TOP-K 
---

### 1. 场景一：单机内存处理（Static Data, Fit in Memory）
假设给你一个包含 $N$ 个整数的数组，内存放得下，找出最大的 $K$ 个。

#### 方法 A：全量排序 (Naive Approach)
*   **做法**：使用 `std::sort` (QuickSort/MergeSort) 将数组完全排序，然后取前 $K$ 个。
*   **复杂度**：$O(N \log N)$。
*   **评价**：**最差**。当 $N$ 很大而 $K$ 很小时（例如 $N=1000万, K=10$），做了大量无用功。

#### 方法 B：最小堆 (Min-Heap) —— **工程首选**
*   **做法**：
    1.  维护一个大小为 $K$ 的**小顶堆**。
    2.  遍历数组，将元素压入堆。
    3.  如果堆的大小超过 $K$，弹出堆顶（即堆中最小的元素，也就是当前 Top K 里最弱的那个）。
    4.  最终堆里剩下的就是最大的 $K$ 个。
*   **复杂度**：$O(N \log K)$。
*   **评价**：**最通用、最稳健**。特别是当 $K \ll N$ 时，效率极高。你优化后的代码用的就是这个。

#### 方法 C：快速选择 (Quick Select) —— **平均最快**
*   **做法**：基于快速排序（Quick Sort）的 Partition 思想。
    1.  随机选一个 Pivot，将数组分为“比 Pivot 大”和“比 Pivot 小”两部分。
    2.  看 Pivot 的位置：
        *   如果 Pivot 正好在第 $K$ 个位置，那么它左边的就是 Top K。
        *   如果 Pivot 在 $K$ 之后，递归处理左边。
        *   如果 Pivot 在 $K$ 之前，递归处理右边。
*   **复杂度**：平均 $O(N)$，最坏 $O(N^2)$。
*   **评价**：**理论最快**，但修改了原数组，且不稳定。C++ 标准库中有 `std::nth_element` 就是这个实现。

---

### 2. 场景二：海量数据/流式数据（Streaming Data）
假设数据是实时流进来的（像网络包、日志），或者数据在磁盘上，内存放不下 $N$ 个元素。

*   **限制**：无法将所有数据加载到内存，无法使用 Quick Select。
*   **唯一解法：最小堆 (Min-Heap)**。
    *   **原理**：不管 $N$ 有多大（1TB 甚至无穷大），内存中只需要维护一个 $K$ 大小的堆。
    *   **空间复杂度**：$O(K)$。
*   **应用**：实时热搜榜、DDOS 攻击检测（流量最大的 K 个 IP）。

---

### 3. 场景三：分布式大数据（Distributed / Big Data）
假设有 10 亿行数据，分布在 1000 台机器上，要找全局 Top-K。

*   **限制**：单机算不动，网络带宽有限。
*   **解法：分治法 (MapReduce 思想)**
    1.  **Map 阶段**：每台机器在本地数据上计算**局部 Top-K**（使用堆）。
    2.  **Reduce 阶段**：每台机器将这 $K$ 个元素发送给一台中心机器（或者下一层聚合节点）。
    3.  **Merge 阶段**：中心机器收集到 $1000 \times K$ 个元素，再做一次 Top-K，得到全局 Top-K。
*   **关键点**：传输的数据量非常小（只有 $K$），而不是 $N$。

---

### 4. 场景四：统计“频率”最高的 Top-K (Heavy Hitters)
上面的场景都是基于元素的值（Value）排序。如果问题是：**“在一个 100GB 的日志文件中，找出出现次数最多的 10 个 IP 地址”**。

这是一个难点，因为你不仅要排序，还要先**统计计数**。

#### 方法 A：Hash Map + Heap (精确解)
*   **做法**：用 Hash Map 统计所有 IP 的出现次数，然后把 (IP, Count) 扔进堆里求 Top-K。
*   **缺点**：如果有 10 亿个不同的 IP，Hash Map 内存会爆炸。

#### 方法 B：Hash 分片 (精确解，分布式)
*   **做法**：
    1.  把 IP 按照 `hash(IP) % 1024` 分发到 1024 个小文件中。
    2.  这样相同的 IP 肯定在同一个文件里。
    3.  分别加载每个小文件到内存，用 Hash Map 统计并求局部 Top-K。
    4.  最后归并。

#### 方法 C：Count-Min Sketch / Misra-Gries (近似解)
*   **场景**：允许一点点误差，但必须极省内存（比如路由器硬件）。
*   **做法**：使用概率数据结构（如 Count-Min Sketch）。
    *   用多个 Hash 函数将元素映射到二维数组中进行计数。
    *   不需要存储 IP 本身，只存储计数值。
    *   **优点**：用极小的空间（几KB）就能统计海量数据。

---

### 5. 数据库中的 Top-K 优化
`SELECT * FROM table ORDER BY col LIMIT K`。

数据库优化器通常会按以下顺序尝试：

1.  **利用索引 (Index Scan)**：
    *   如果在 `col` 上有 B+ 树索引，索引本身就是有序的。
    *   数据库只需要读索引的最左边（或最右边）的 $K$ 个条目。
    *   **复杂度**：$O(K)$。这是极速模式。

2.  **Top-N Heap Sort：
    *   如果没索引，必须全表扫描。
    *   在扫描过程中维护一个大小为 $K$ 的堆。
    *   **复杂度**：$O(N \log K)$。

3.  **全量排序 (External Sort)**：
    *   如果 $K$ 非常大（比如 `LIMIT 1000000`），堆太大内存放不下。
    *   退化为外部归并排序。

### 总结表

| 场景                   | 最佳策略                 | 复杂度           | 备注             |
| :------------------- | :------------------- | :------------ | :------------- |
| **内存充足，静态数据**        | **Quick Select**     | $O(N)$        | 会修改原数组         |
| **内存充足，一般通用**        | **Min-Heap**         | $O(N \log K)$ | 不改原数组，稳定       |
| **流式数据 (Streaming)** | **Min-Heap**         | $O(N \log K)$ | 空间仅需 $O(K)$    |
| **海量数据 (分布式)**       | **分治 + 归并**          | -             | MapReduce 经典案例 |
| **高频词统计 (精确)**       | **Hash分片 + Heap**    | -             | 解决 Map 内存爆炸问题  |
| **高频词统计 (近似)**       | **Count-Min Sketch** | $O(1)$ 空间     | 牺牲精度换空间        |
