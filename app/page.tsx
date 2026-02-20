import QuickSizerApp from "@/components/QuickSizerApp";

export default function HomePage() {
  return (
    <main className="grid" style={{ gap: "1.2rem" }}>
      <section className="card" style={{ padding: "1.2rem" }}>
        <h1>Max Success Plan Premium Services Quicksizer</h1>
        <p className="muted" style={{ marginTop: "0.55rem" }}>
          Guided experience for engagement sizing, configuration, service transparency, and workbook re-import.
        </p>
      </section>
      <QuickSizerApp />
    </main>
  );
}
