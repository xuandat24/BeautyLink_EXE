import { Component, Suspense, type PropsWithChildren } from 'react';

/** A failed route download must show a recoverable screen, not leave a blank page. */
export class PageLoadBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() { return { failed: true }; }

  render() {
    if (this.state.failed) return <div role="alert" className="grid min-h-screen place-items-center bg-pink-50 p-6 text-center">
      <div><h1 className="text-lg font-bold text-slate-800">Không thể tải trang</h1>
        <p className="mt-2 text-sm text-slate-600">Vui lòng kiểm tra kết nối và tải lại trang để tiếp tục.</p>
        <button type="button" onClick={() => window.location.reload()}
          className="mt-4 rounded-xl bg-pink-600 px-5 py-2 text-sm font-bold text-white">Tải lại trang</button>
      </div>
    </div>;
    return <Suspense fallback={<div role="status" aria-live="polite"
      className="grid min-h-screen place-items-center bg-pink-50 text-sm font-bold text-slate-600">Đang tải trang...</div>}>
      {this.props.children}
    </Suspense>;
  }
}
