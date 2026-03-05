import type { Ref } from "react";

type Props = {
  src: string;
  title?: string;
  allow?: string;
  allowFullScreen?: boolean;
  className?: string;
  frameClassName?: string;
  iframeRef?: Ref<HTMLIFrameElement>;
};

export function CallFrame({
  src,
  title = "Call",
  allow = "camera; microphone; autoplay; fullscreen; display-capture; speaker-selection",
  allowFullScreen = true,
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
        allowFullScreen={allowFullScreen}
        ref={iframeRef}
      />
    </div>
  );
}
