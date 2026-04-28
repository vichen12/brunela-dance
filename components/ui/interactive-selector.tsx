"use client";

import { Lock, PlayCircle } from "lucide-react";
import { usePublicI18n } from "@/components/language-provider";
import type { PublicMessageKey } from "@/src/i18n/public";

const previews = [
  {
    title: "preview.ballet.title",
    detail: "preview.ballet.detail",
    meta: "preview.ballet.meta",
    img: "/fotos-landing/Ballet.jpg",
    pos: "center top",
  },
  {
    title: "preview.rotation.title",
    detail: "preview.rotation.detail",
    meta: "preview.rotation.meta",
    img: "/fotos-landing/Progressing Ballet Technique.jpg",
    pos: "center",
  },
  {
    title: "preview.split.title",
    detail: "preview.split.detail",
    meta: "preview.split.meta",
    img: "/fotos-landing/Stretching.jpg",
    pos: "center top",
  },
] as const;

const tags = ["Ballet", "Pilates", "PBT", "Stretching", "Contemporary"];

export function InteractiveSelector() {
  const { t } = usePublicI18n();
  const [featured, ...secondary] = previews;

  return (
    <div className="preview-studio-panel">
      <a
        href="/#planes"
        className="preview-featured-card"
        aria-label={`${t(featured.title as PublicMessageKey)}. ${t("preview.lockAria")}`}
      >
        <div className="preview-featured-image">
          <img src={featured.img} alt="" style={{ objectPosition: featured.pos }} draggable={false} />
          <span className="preview-featured-play">
            <PlayCircle size={42} strokeWidth={1.55} />
          </span>
        </div>

        <div className="preview-featured-copy">
          <span className="preview-lock">
            <Lock size={13} />
            {t("preview.lockFull")}
          </span>
          <h3>{t(featured.title as PublicMessageKey)}</h3>
          <p>{t(featured.detail as PublicMessageKey)}</p>
          <small>{t(featured.meta as PublicMessageKey)}</small>
        </div>
      </a>

      <div className="preview-side-stack">
        {secondary.map((item) => (
          <a
            key={item.title}
            href="/#planes"
            className="preview-side-card"
            aria-label={`${t(item.title as PublicMessageKey)}. ${t("preview.lockAria")}`}
          >
            <div className="preview-side-image">
              <img src={item.img} alt="" style={{ objectPosition: item.pos }} draggable={false} />
              <span>
                <PlayCircle size={24} strokeWidth={1.7} />
              </span>
            </div>

            <div className="preview-side-copy">
              <span className="preview-lock">
                <Lock size={12} />
                {t("preview.lockShort")}
              </span>
              <h3>{t(item.title as PublicMessageKey)}</h3>
              <p>{t(item.detail as PublicMessageKey)}</p>
              <small>{t(item.meta as PublicMessageKey)}</small>
            </div>
          </a>
        ))}

        <div className="preview-mini-row">
          {tags.map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
