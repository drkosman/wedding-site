export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="section bg-secondary text-center">
      <div className="container-page">
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          Map data and imagery attribution: Powered by Esri. Copyright Kosta Manser {year}.
        </p>
      </div>
    </footer>
  );
}
