// The sample CSV is bundled as text, so loading it needs no network request.
declare module "*.csv" {
  const text: string;
  export default text;
}

declare module "*.css";
