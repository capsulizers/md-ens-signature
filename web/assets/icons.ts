import { registerIconLibrary } from "@awesome.me/webawesome/dist/components/icon/library.js";

/**
 * The Bootstrap icons this page names, inlined as data URIs so no icon is
 * ever fetched from a CDN. Add a name here when a new icon is used; a missing
 * one falls back to the question mark glyph.
 */
const ICON_SOURCES = import.meta.glob<string>(
  "../node_modules/bootstrap-icons/icons/{arrow-left,box-arrow-up-right,check-circle-fill,circle,clock-history,download,file-earmark,folder2-open,person-check,person-plus,person-x,pen,hourglass-split,patch-check-fill,question-diamond,search,send,shield-exclamation,stars,wallet2,x-octagon-fill}.svg",
  {
    eager: true,
    import: "default",
    query: "?raw",
  },
);

const FALLBACK_ICON_NAME = "question-diamond";

function buildIconUris(): Map<string, string> {
  const iconUris = new Map<string, string>();
  for (const [path, source] of Object.entries(ICON_SOURCES)) {
    const fileName = path.slice(path.lastIndexOf("/") + 1);
    iconUris.set(
      fileName.slice(0, -".svg".length),
      `data:image/svg+xml,${encodeURIComponent(source)}`,
    );
  }
  return iconUris;
}

const ICON_URIS = buildIconUris();
const FALLBACK_ICON_URI = ICON_URIS.get(FALLBACK_ICON_NAME) ?? "";

function mutateIcon(svg: SVGElement): void {
  svg.style.width = "100%";
  svg.style.height = "100%";
}

registerIconLibrary("default", {
  resolver: (name: string): string => ICON_URIS.get(name) ?? FALLBACK_ICON_URI,
  mutator: mutateIcon,
});
