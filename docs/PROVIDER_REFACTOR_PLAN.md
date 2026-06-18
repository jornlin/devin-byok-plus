# sidebarProvider.js 拆分重构实施方案

> 制定时间：2026-06-17
> 目标文件：`src/providers/sidebarProvider.js`（2636 行 / 178 方法 / 93KB）
> 分支：feature/ui-refactor-tailwind

---

## 一、背景与现状诊断

### 1.1 核心问题：God Object（上帝对象）

`sidebarProvider.js` 是典型的上帝对象，单个类承担了至少 8 类职责：

| 职责类别 | 代表方法 | 是否属于 Controller |
|---------|---------|-------------------|
| WebView 生命周期 | resolveWebviewView、refresh、getHtml | ✅ 是 |
| 消息分发 | handleMessage（23 个 case） | ✅ 是 |
| 网络诊断 | measureTcpLatency、checkHttpHealth、probeConfiguredModelStream | ❌ 应抽离 |
| 模型拉取 | httpGetModels、fetchModelsFromGateway、normalizeModelsResponse | ❌ 应抽离 |
| 环境检查/报告 | checkManagedEnvironment、createDiagnosticReport | ❌ 应抽离 |
| 维护工具 | clearWindsurfCache、forceRestartLanguageServer | ❌ 应抽离 |
| 提示词管理 | applySystemPromptContent、openPromptTemplatePicker | ❌ 应抽离 |
| 配置/状态 | getModeScopedConfig、validateByokSlots、writeModeScopedConfig | ❌ 应抽离 |

### 1.2 认知纠正：不应合并到 views/

`sidebarProvider.js` 是 **Controller（控制器）**，不是 View。其视图渲染部分（getHtml 中的 HTML 拼装）**已经**抽到 `src/views/`。剩余 2560 行是业务逻辑，应横向拆成 `services/` 下的独立模块，**而非塞进 views/**（那会破坏分层）。

### 1.3 已发现的隐患（重构前必须知晓）

1. **死代码模块**：`sidebar-utils.js`、`sidebar-state.js`、`sidebar-models.js` 共 464 行，全项目 0 引用。其中 `sidebar-state.js` 的 `DEFAULT_SYSTEM_PROMPT`、`BUILT_IN_PROMPT_TEMPLATES` 与主文件第 61-160 行完全重复。→ 之前有人尝试拆分但未接线。

2. **27 个测试失败**：`tests 79 | pass 52 | fail 27`。失败原因分四类：
   - **A 类（断言旧需求）**：如"系统补丁应该是第一个 tab"，但已按需求改为配置优先 → 需改写断言。
   - **B 类（读旧文件位置）**：读 `sidebarTemplate.js` 字符串找 HTML，但 HTML 已移到 `templates/partials/*.html` → 改为渲染后断言。
   - **C 类（引用不存在的文档）**：`PHASE4_VERIFICATION.md` 等三个文档不在磁盘上 → 移除文档存在性测试。
   - **D 类（测试自身缺陷）**：ESM 测试里用 `require()`（未定义）、XSS 测试绕过了生产转义路径。

3. **转义逻辑分裂**：用户输入的转义一半在 `getHtml()`（byok 字段），一半在 `sidebarTemplate.js`（路径字段），不一致且脆弱。

4. **变量名混淆**：全文用 `tmp02`/`tmp1`/`arg0` 等反编译式命名，跨方法移动代码极易错位 —— **这是最大风险源**。

---

## 二、目标架构

```
src/
├── providers/
│   ├── sidebarProvider.js        # 仅保留 Controller 职责（~500 行）
│   ├── sidebar-utils.js          # 接线复用：纯工具函数
│   └── sidebar-state.js          # 接线复用：配置/状态/常量
├── services/
│   ├── diagnostics.js            # 网络/路由诊断 + 诊断报告（~700 行）
│   ├── modelFetcher.js           # 模型拉取与规范化（~300 行）
│   ├── maintenanceTools.js       # 缓存清理 / LS 重启（~300 行）
│   └── systemPromptManager.js    # 提示词模板与编辑（~250 行）
└── views/                        # 保持不变（已是纯渲染层）
    ├── sidebarTemplate.js        # 数据准备层（含统一转义）
    └── templates/                # HTML 模板
```

**拆分原则**：
- 纯函数优先抽离（无 `this` 依赖，风险最低）。
- 有状态逻辑抽成 service 类，由 Controller 持有实例并注入依赖（context、proxyManager）。
- 每抽一块，立即跑测试验证行为一致。
- 不重命名混淆变量（单独一轮做，避免与移动代码混在一起放大风险）。

---

## 三、分阶段实施计划

### 阶段 0：稳定化（前置必做，零~低风险）

**目标**：建立绿色测试基线 + 清理死代码 + 统一转义。这是后续所有重构的安全前提。

| 步骤 | 动作 | 验证 |
|------|------|------|
| 0.1 | 修复 A 类测试：改写 tab 顺序/默认 tab 断言为"配置优先" | 跑测试 |
| 0.2 | 修复 B 类测试：改为调用 `renderSidebarHtml(mockCtx)` 渲染后断言，不再读源码字符串 | 跑测试 |
| 0.3 | 修复 C 类测试：移除对不存在文档的存在性断言 | 跑测试 |
| 0.4 | 修复 D 类测试：ESM 用 `createRequire`/动态 import；XSS 见 0.5 | 跑测试 |
| 0.5 | 统一转义：把用户输入转义集中到 `sidebarTemplate.js`，移除 `getHtml()` 中重复的 `esc()`，防止双重转义 | XSS 测试通过 + 手工核对无双转义 |
| 0.6 | 清死代码：删除/接线 3 个未引用模块；消除重复常量 | 跑测试 + 构建 |

**完成标准**：`npm test` 全绿，`npm run build` 成功。

### 阶段 1：抽纯工具函数（低风险）

将 `redactSecret`、`shellQuote`、`isValidPortValue`、`isValidCompletionTimeoutValue`、`jsonBlock`、`textBlock`、`envCheckItem` 等无状态函数迁移到 `sidebar-utils.js`，Provider 改为 import。

**验证**：每迁一个函数跑一次测试；构建通过。

### 阶段 2：抽 modelFetcher + diagnostics（中风险）

- `modelFetcher.js`：normalizeModelsResponse、httpGetModels、getModelListUrl、normalizeProviderBaseUrl、resolveModelFetchCredentials、fetchModelsFromGateway、flattenModelIds、modelIdMatches、formatModelFetchError。
- `diagnostics.js`：measureTcpLatency、checkHttpHealth、probe*、classifyProbe*、check*Routing、checkGatewayModelCatalog、checkManagedEnvironment、createDiagnosticReport、exportDiagnosticReport。

抽成 service 类，构造时注入 `proxyManager`。Provider 持有实例并委托调用。

**验证**：针对每个 service 补单元测试（mock 网络）；跑全量测试。

### 阶段 3：抽 maintenanceTools + systemPromptManager（中风险）

- `maintenanceTools.js`：runDetachedCacheCleaner、forceRestartLanguageServer、clearWindsurfCache、openMaintenanceTools、repairManagedEnvironment。
- `systemPromptManager.js`：getSystemPromptTargetPath、applySystemPromptContent、openPromptTemplatePicker、openSystemPromptEditor、restartProxyForPromptConfigIfRunning + 提示词常量（复用 sidebar-state.js）。

**验证**：跑全量测试 + 构建。

### 阶段 4（可选，独立进行）：变量名去混淆

在结构稳定后，单独一轮把 `tmp02`/`tmp1`/`arg0` 重命名为语义名。**必须独立于结构改动**，借助测试基线保护。

---

## 四、风险控制

1. **每阶段可停**：每步结束都有可工作、可验证的产物。
2. **测试先行**：阶段 0 先建立基线，之后每次改动都跑测试对比。
3. **小步提交**：每个 service 抽离单独 commit，便于回滚（`git revert`）。
4. **不混合关注点**：结构移动与变量重命名分开做。
5. **保持公共接口**：`SidebarProvider` 的构造签名与 `extension.js` 的调用方式不变。

---

## 五、验证策略

| 层级 | 手段 |
|------|------|
| 单元 | `npm test`（node:test），每个 service 补 mock 测试 |
| 构建 | `npm run build`（Tailwind + esbuild） |
| 加载 | `node -e "require('./src/providers/sidebarProvider.js')"` |
| 手工 | 关键路径：启动代理、保存配置、拉模型、装补丁、诊断报告 |

---

## 六、执行记录

- [x] **阶段 0：稳定化**（2026-06-17 完成）
  - 0.1-0.4：修复 27 个失败测试 → `tests 78 | pass 78 | fail 0`
  - 0.5：转义统一到 sidebarTemplate 数据准备层，移除 getHtml 重复 esc()，XSS 测试合法通过且无双重转义
  - 0.6：删除 3 个零引用死模块（sidebar-utils/state/models，共 464 行），重复常量归一
  - 验证：测试全绿 + esbuild 打包成功（215.1kb）
  - 备注：Provider 无法用裸 `node -e` 加载是既有约束（reloadWorkbench.js:7 裸 require vscode），非本次引入
- [x] **阶段 1：纯工具函数**（2026-06-17 完成，commit 4e55659）
  - 抽 7 个无状态函数到 sidebar-utils.js，替换 37 处调用，+22 测试
- [x] **阶段 2a：modelFetcher**（2026-06-17 完成，commit f4f52f3）
  - 抽 11 个模型拉取方法到 services/modelFetcher.js，fetchModelsFromGateway 注入 proxyManager，+23 测试
- [x] **阶段 2b：diagnostics**（2026-06-17 完成，commit 7ac87d2）
  - 抽 4 分类器 + 3 路由解析 + 2 常量到 services/diagnostics.js，删死代码 measureTcpLatency，+21 测试
- [x] **阶段 3：提示词模板数据**（2026-06-17 完成）
  - 抽 DEFAULT_SYSTEM_PROMPT + BUILT_IN_PROMPT_TEMPLATES 到 services/promptTemplates.js，+8 测试
  - **范围决策**：maintenanceTools / systemPrompt 编辑等方法**未抽离**。经评估它们深度耦合控制器
    （17 处 vscode 对话框 + 大量 this.proxyManager/postActionState/refresh/context），属于真正的
    UI 编排职责；强行抽成 service 需注入 vscode/proxyManager/context 与多个回调，制造别扭间接层、
    高回归风险且无测试网兜底，收益甚微。故仅抽离纯数据，编排逻辑保留在 Controller。
- [ ] 阶段 4（可选）：去混淆

## 七、最终成果

- Provider：2636 → 2129 行（-507 行，-19%）
- 新增 4 个可复用模块：sidebar-utils、modelFetcher、diagnostics、promptTemplates
- 测试：52（且 27 失败）→ 152 全绿（+100 用例，4 个模块各有专属测试）
- 删除死代码：3 个零引用模块（464 行）+ measureTcpLatency
- 修复真实问题：转义双重/分裂、XSS 断言、过时测试断言

