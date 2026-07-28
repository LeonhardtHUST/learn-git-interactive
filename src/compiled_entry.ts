import { main } from "./main";

// Solid 构建插件转换入口模块后，import.meta.main 不再可用；
// 独立可执行文件使用此入口，显式执行与源码启动相同的 main()。
await main();
