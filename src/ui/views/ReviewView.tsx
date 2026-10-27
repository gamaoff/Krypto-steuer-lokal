import type { Alert } from "../../engine/index.ts";
import { day, units } from "../format.ts";
import { useI18n, type Key } from "../i18n.ts";
import { Dec } from "../../engine/index.ts";

export function ReviewView({ alerts }: { alerts: Alert[] }) {
  const { t, lang } = useI18n();

  if (alerts.length === 0) {
    return (
      <div className="view">
        <h1>{t("review.title")}</h1>
        <p className="lead ok">{t("review.empty")}</p>
      </div>
    );
  }

  const params = (a: Alert): Record<string, string> => {
    const p: Record<string, string> = { ...a.params };
    if (p.day) p.day = day(p.day, lang);
    if (p.missing) p.missing = units(Dec.parse(p.missing), lang);
    return p;
  };

  return (
    <div className="view">
      <h1>{t("review.title")}</h1>
      <p className="lead">{t("review.lead", { n: alerts.length })}</p>
      <ul className="alerts">
        {alerts.map((a, i) => {
          const p = params(a);
          const body =
            a.code === "PARSE_BAD_ROW"
              ? t(`reason.${a.params.reason}` as Key, p)
              : t(`alert.${a.code}.body` as Key, p);
          return (
            <li key={i} className={`alert alert--${a.severity}`}>
              <h2 className="alert__title">{t(`alert.${a.code}.title` as Key, p)}</h2>
              <p>{body}</p>
              <p className="alert__todo">
                <strong>{t("review.todo")}</strong> {t(`alert.${a.code}.action` as Key, p)}
              </p>
              {a.source && <p className="alert__source">{t("review.source", { file: a.source.file, line: a.source.line })}</p>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
