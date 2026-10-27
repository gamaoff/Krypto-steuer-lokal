import { useI18n } from "../i18n.ts";

export function PrivacyView({ requests, blocked }: { requests: number; blocked: number }) {
  const { t } = useI18n();
  const policy =
    document.querySelector<HTMLMetaElement>('meta[http-equiv="Content-Security-Policy"]')?.content ?? "";

  return (
    <div className="view view--privacy">
      <h1>{t("privacy.title")}</h1>
      <p className="bignum">
        <span className="bignum__n">{requests}</span>
        <span className="bignum__text">{t("privacy.count", { n: requests })}</span>
      </p>
      {blocked > 0 && <p className="warn">{t("privacy.blocked", { n: blocked })}</p>}
      <p>{t("privacy.why")}</p>
      <p>{t("privacy.storage")}</p>
      <p>{t("privacy.fonts")}</p>

      <h2 className="h3">{t("privacy.howTitle")}</h2>
      <ol className="steps">
        <li>{t("privacy.how1")}</li>
        <li>{t("privacy.how2")}</li>
        <li>{t("privacy.how3")}</li>
      </ol>

      <h2 className="h3">{t("privacy.policy")}</h2>
      <pre className="policy">{policy.split(";").map((d) => d.trim()).filter(Boolean).join(";\n")}</pre>
    </div>
  );
}
