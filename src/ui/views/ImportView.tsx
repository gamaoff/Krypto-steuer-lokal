import { useRef, useState, type DragEvent } from "react";
import { COLUMNS } from "../../engine/index.ts";
import sampleCsv from "../../../sample/beispiel-transaktionen.csv";
import { useI18n } from "../i18n.ts";
import { downloadText, type FileStats, type LoadedFile } from "../state.ts";

const TEMPLATE = [
  COLUMNS.join(","),
  "2025-01-05 09:00,buy,Bitpanda,BTC,0.001,,,98.51,1.49,,Sparplan",
  "2025-02-01 10:00,transfer,Bitpanda,,,BTC,0.001,,,Ledger,",
  "2025-03-01 02:00,reward,Kraken,ETH,0.004,,,8.00,,,Staking",
  "2025-04-10 16:00,swap,Kraken,SOL,10,ETH,0.5,1000.00,2.50,,",
  "2025-05-20 12:00,sell,Kraken,,,SOL,5,700.00,1.75,,",
].join("\n");

interface Props {
  files: FileStats[];
  onAdd: (files: LoadedFile[]) => void;
  onRemove: (name: string) => void;
  onClear: () => void;
  onDone: () => void;
}

export function ImportView({ files, onAdd, onRemove, onClear, onDone }: Props) {
  const { t } = useI18n();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const read = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setError(null);
    const loaded: LoadedFile[] = [];
    for (const f of Array.from(list)) {
      try {
        loaded.push({ name: f.name, text: await f.text() });
      } catch {
        setError(t("import.readError", { file: f.name }));
      }
    }
    if (loaded.length > 0) onAdd(loaded);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    void read(e.dataTransfer.files);
  };

  return (
    <div className="view view--import">
      <h1>{t("import.title")}</h1>
      <p className="lead">{t("import.lead")}</p>

      <div
        className={`drop${dragging ? " drop--active" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <p className="drop__title">{t("import.drop")}</p>
        <p className="drop__or">{t("import.or")}</p>
        <button type="button" className="btn btn--primary" onClick={() => input.current?.click()}>
          {t("import.choose")}
        </button>
        <input ref={input} type="file" accept=".csv,text/csv" multiple hidden onChange={(e) => { void read(e.target.files); e.target.value = ""; }} />
      </div>
      {error && <p className="error" role="alert">{error}</p>}

      <div className="import-aside">
        <div>
          <button type="button" className="btn" onClick={() => onAdd([{ name: "beispiel-transaktionen.csv", text: sampleCsv }])}>
            {t("import.sample")}
          </button>
          <p className="hint">{t("import.sampleHint")}</p>
        </div>
        <div>
          <h2 className="h3">{t("import.formatTitle")}</h2>
          <p className="hint">{t("import.formatBody")}</p>
          <button type="button" className="btn btn--quiet" onClick={() => downloadText("vorlage-transaktionen.csv", TEMPLATE + "\n")}>
            {t("import.template")}
          </button>
        </div>
      </div>

      {files.length > 0 && (
        <div className="filelist">
          <h2 className="h3">{t("import.files")}</h2>
          <ul>
            {files.map((f) => (
              <li key={f.name}>
                <span className="filelist__name">{f.name}</span>
                <span className="filelist__meta">
                  {t("import.rows", { n: f.rows })}
                  {f.problems > 0 && <span className="filelist__bad">{t("import.problems", { n: f.problems })}</span>}
                </span>
                <button type="button" className="btn btn--link" onClick={() => onRemove(f.name)}>{t("import.remove")}</button>
              </li>
            ))}
          </ul>
          <div className="row">
            <button type="button" className="btn btn--primary" onClick={onDone}>{t("import.next")}</button>
            <button type="button" className="btn btn--link" onClick={onClear}>{t("import.removeAll")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
