import type { Ref } from "react";

type Props = {
  src: string;
  title?: string;
  allow?: string;
  className?: string;
  frameClassName?: string;
  iframeRef?: Ref<HTMLIFrameElement>;
};

export function CallFrame({
  src,
  title = "Call",
  allow = "camera; microphone; fullscreen",
  className,
  frameClassName,
  iframeRef
}: Props) {
  return (
    <div className={className}>
      <iframe
        title={title}
        src={src}
        className={frameClassName ?? "w-full h-full"}
        allow={allow}
        ref={iframeRef}
      />
    </div>
  );
}
