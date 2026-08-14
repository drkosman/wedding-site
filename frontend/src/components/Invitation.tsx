export default function Invitation() {
  return (
    <section className="invitation-section" aria-labelledby="invitation-couple">
      <div className="invitation-inner">
        <p className="invitation-parents">Mark and Nicki Wakeford</p>

        <div className="invitation-wording">
          <p>have the pleasure of inviting you</p>
          <p>to the wedding of</p>
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
