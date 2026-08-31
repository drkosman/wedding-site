export default function Invitation() {
  return (
    <section className="invitation-section" aria-labelledby="invitation-couple">
      <div className="invitation-inner">
        <p className="invitation-parents">Mr & Mrs Mark Wakeford</p>

        <div className="invitation-wording">
          <p>request the pleasure of your company</p>
          <p>to celebrate the marriage of</p>
        </div>

        <h2 id="invitation-couple" className="invitation-couple">
          <span>Lucy Wakeford</span>
          <span className="invitation-and">and</span>
          <span>Kosta Manser</span>
        </h2>
      </div>
    </section>
  );
}
