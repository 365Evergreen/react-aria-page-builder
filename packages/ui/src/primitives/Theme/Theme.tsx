import { CheckCircle2, Copy, Download, Info, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import styles from "./Theme.module.css";

type ThemeInputs = {
  primary: string;
  text: string;
  background: string;
};

type ContrastLevel = "AA" | "AA large text" | "Fail";

const defaultInputs: ThemeInputs = {
  primary: "#092c47",
  text: "#323130",
  background: "#faf9f8",
};

const primaryTones = [
  ["themePrimary", 0],
  ["themeLighterAlt", 0.82],
  ["themeLighter", 0.67],
  ["themeLight", 0.52],
  ["themeTertiary", 0.36],
  ["themeSecondary", 0.2],
  ["themeDarkAlt", -0.2],
  ["themeDark", -0.36],
  ["themeDarker", -0.52],
] as const;

const neutralTones = [
  ["neutralLighterAlt", 0.02],
  ["neutralLighter", 0.07],
  ["neutralLight", 0.12],
  ["neutralQuaternaryAlt", 0.2],
  ["neutralQuaternary", 0.3],
  ["neutralTertiaryAlt", 0.36],
  ["neutralTertiary", 0.52],
  ["neutralSecondaryAlt", 0.62],
  ["neutralSecondary", 0.7],
  ["neutralPrimaryAlt", 0.84],
  ["neutralPrimary", 1],
  ["neutralDark", 0.92],
] as const;

function isHexColor(value: string) {
  return /^#[\da-f]{6}$/i.test(value);
}

function normalizeColor(value: string) {
  const trimmed = value.trim();
  if (/^#[\da-f]{3}$/i.test(trimmed)) {
    return `#${trimmed.slice(1).split("").map((character) => character + character).join("")}`;
  }
  return trimmed;
}

function toRgb(hex: string) {
  const normalized = normalizeColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}`;
}

function mix(from: string, to: string, amount: number) {
  const start = toRgb(from);
  const end = toRgb(to);
  return toHex({
    r: start.r + (end.r - start.r) * amount,
    g: start.g + (end.g - start.g) * amount,
    b: start.b + (end.b - start.b) * amount,
  });
}

function createTheme({ primary, text, background }: ThemeInputs) {
  const theme = Object.fromEntries(
    primaryTones.map(([name, amount]) => [
      name,
      amount >= 0 ? mix(primary, "#ffffff", amount) : mix(primary, "#000000", -amount),
    ]),
  );

  return {
    ...theme,
    ...Object.fromEntries(neutralTones.map(([name, amount]) => [name, mix(background, text, amount)])),
    black: "#000000",
    white: "#ffffff",
  };
}

function relativeLuminance(color: string) {
  const { r, g, b } = toRgb(color);
  const linear = [r, g, b].map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

function contrastRatio(foreground: string, background: string) {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

function contrastLevel(ratio: number): ContrastLevel {
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large text";
  return "Fail";
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const valid = isHexColor(normalizeColor(value));

  return (
    <label className={styles.colorField}>
      <span>{label}</span>
      <span className={styles.colorControl}>
        <input
          type="color"
          value={valid ? normalizeColor(value) : "#000000"}
          onChange={(event) => onChange(event.target.value)}
          aria-label={`${label} color picker`}
        />
        <input
          className={`${styles.input} ${styles.colorInput} ${!valid ? styles.invalidInput : ""}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          spellCheck={false}
          aria-invalid={!valid}
          aria-describedby={!valid ? `${label.replaceAll(" ", "-").toLowerCase()}-error` : undefined}
        />
      </span>
      {!valid && <span id={`${label.replaceAll(" ", "-").toLowerCase()}-error`} className={styles.formError}>Enter a 3 or 6 digit hex color.</span>}
    </label>
  );
}

export function Theme() {
  const [inputs, setInputs] = useState<ThemeInputs>(defaultInputs);
  const [copied, setCopied] = useState(false);
  const validInputs = Object.values(inputs).every((color) => isHexColor(normalizeColor(color)));
  const normalizedInputs = validInputs
    ? Object.fromEntries(Object.entries(inputs).map(([name, value]) => [name, normalizeColor(value)])) as ThemeInputs
    : defaultInputs;
  const theme = useMemo(() => createTheme(normalizedInputs), [normalizedInputs]);
  const output = JSON.stringify(theme, null, 2);
  const checks = validInputs
    ? [
        { label: "Text on background", foreground: normalizedInputs.text, background: normalizedInputs.background },
        { label: "Primary on background", foreground: normalizedInputs.primary, background: normalizedInputs.background },
        { label: "White on primary", foreground: "#ffffff", background: normalizedInputs.primary },
      ].map((check) => ({ ...check, ratio: contrastRatio(check.foreground, check.background) }))
    : [];
  const allPass = checks.every((check) => check.ratio >= 4.5);

  const updateColor = (name: keyof ThemeInputs, value: string) => {
    setCopied(false);
    setInputs((current) => ({ ...current, [name]: value }));
  };

  const copyTheme = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
  };

  const downloadTheme = () => {
    const file = new Blob([output], { type: "application/json" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "theme.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.content}>
      <div className={styles.pageHead}>
        <div>
          <h1>Themes</h1>
          <p className={styles.pageDescription}>Choose the core colors for your site. Theme variants update as you edit.</p>
        </div>
      </div>

      <div className={styles.themeGrid}>
        <section className={styles.card}>
          <h2>Core colors</h2>
          <p className={styles.muted}>Use hexadecimal values to generate a Fluent UI compatible palette.</p>
          <div className={styles.colorFields}>
            <ColorField label="Primary color" value={inputs.primary} onChange={(value) => updateColor("primary", value)} />
            <ColorField label="Text color" value={inputs.text} onChange={(value) => updateColor("text", value)} />
            <ColorField label="Background color" value={inputs.background} onChange={(value) => updateColor("background", value)} />
          </div>
        </section>

        <section className={`${styles.card} ${styles.accessibilityCard}`} aria-live="polite">
          <div className={styles.sectionTitle}>
            {allPass && validInputs ? <CheckCircle2 className={styles.passIcon} size={20} /> : <ShieldAlert className={styles.warnIcon} size={20} />}
            <h2>Accessibility</h2>
          </div>
          <p className={styles.muted}>
            {validInputs
              ? allPass
                ? "All essential color pairings meet WCAG AA contrast for normal text."
                : "Update the selected colors until essential text pairings meet WCAG AA."
              : "Enter valid hex colors to check contrast."}
          </p>
          <div className={styles.contrastChecks}>
            {checks.map((check) => {
              const level = contrastLevel(check.ratio);
              return (
                <div key={check.label} className={styles.contrastCheck}>
                  <span className={styles.contrastSample} style={{ color: check.foreground, background: check.background }}>Aa</span>
                  <span>{check.label}</span>
                  <strong className={level === "AA" ? styles.contrastPass : styles.contrastFail}>{check.ratio.toFixed(2)}:1</strong>
                  <span className={styles.contrastLevel}>{level}</span>
                </div>
              );
            })}
          </div>
          <p className={styles.contrastNote}><Info size={15} /> AA requires 4.5:1 for normal text and 3:1 for large text.</p>
        </section>
      </div>

      <section className={`${styles.card} ${styles.themePreview}`} style={{ background: normalizedInputs.background, color: normalizedInputs.text }}>
        <div>
          <span className={styles.previewLabel}>Live preview</span>
          <h2>Clear stories. Thoughtful design.</h2>
          <p>Preview your selected text and background colors in a typical content layout.</p>
        </div>
        <button className={styles.previewButton} style={{ background: normalizedInputs.primary }}>Read the latest</button>
      </section>

      <section className={styles.card}>
        <div className={styles.outputHead}>
          <div>
            <h2>Generated theme</h2>
            <p className={styles.muted}>Copy or download the JSON output for your Fluent UI theme configuration.</p>
          </div>
          <div className={styles.outputActions}>
            <button className={styles.btn} type="button" onClick={copyTheme}><Copy size={16} /> {copied ? "Copied" : "Copy JSON"}</button>
            <button className={`${styles.btn} ${styles.primary}`} type="button" onClick={downloadTheme}><Download size={16} /> Download</button>
          </div>
        </div>
        <pre className={styles.themeOutput}>{output}</pre>
      </section>
    </div>
  );
}
