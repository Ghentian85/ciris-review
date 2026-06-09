/* eslint-disable @next/next/no-img-element */

// Renders a step screenshot with an optional caption. Always falls back to
// the placeholder SVG if the real image isn't dropped in yet, so the layout
// never collapses while Sam is still capturing screens.
//
// Convention: PNGs go in /public/help/<name>.png, then pass src="<name>".
// Caption renders below as small grey copy.
export function Screenshot({
  src,
  alt,
  caption,
}: {
  src?: string;
  alt: string;
  caption?: string;
}) {
  const resolved = src ? `/help/${src}` : "/help/placeholder.svg";
  return (
    <figure className="my-5">
      <div className="overflow-hidden border hairline bg-bg">
        <img
          src={resolved}
          alt={alt}
          className="block w-full h-auto"
          loading="lazy"
        />
      </div>
      {caption ? (
        <figcaption className="text-[11px] text-muted-soft mt-2 text-center">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
