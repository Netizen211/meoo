/**
 * ============================================================
 *  🍞 Toast 消息提示组件
 *  ============================================================
 *
 *  基于 sonner — https://sonner.emilkowal.ski/
 *  sonner 是 shadcn/ui 生态首选的 Toast 库，轻量（< 5KB），自带样式
 *
 *  ═════════════════════════════════════════════════════════
 *  使用方式：
 *    // 在 App.tsx 根组件添加 <Toaster />
 *    import { Toaster } from 'sonner';
 *    <Toaster />
 *
 *    // 在任何组件中调用 toast
 *    import { toast } from 'sonner';
 *    toast.success('数据上传成功');
 *    toast.error('上传失败，请重试');
 *    toast('这是一条普通消息');
 *    toast('带操作按钮', { action: { label: '撤销', onClick: () => {} } });
 *  ═════════════════════════════════════════════════════════
 *
 *  为什么用 sonner 而不是自己写：
 *    1. 管理后台 Toast 需要支持成功/错误/加载/撤销等多种类型
 *    2. sonner 自带堆叠管理、自动关闭、焦点感知、键盘导航
 *    3. 项目有 20+ 页面，每个页面都有操作反馈，统一用 sonner 保证一致性
 */

// 直接 re-export sonner 的类型和组件
export { Toaster, toast } from 'sonner';

/**
 * 使用提示：
 *
 * 1. 在 App.tsx 中添加 <Toaster />（只需加一次）
 *    <Toaster
 *      position="top-right"
 *      richColors           // 启用成功=绿色/错误=红色/警告=橙色
 *      closeButton          // 显示关闭按钮
 *      duration={3000}      // 3秒自动关闭
 *    />
 *
 * 2. 在任意组件中：
 *    import { toast } from '../components/ui';
 *    toast.success('导入完成');
 *    toast.error('导入失败：文件格式不正确');
 *    toast.loading('正在处理...');
 *    toast.dismiss();       // 关闭所有
 */
