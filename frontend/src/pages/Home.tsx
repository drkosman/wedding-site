import Hero from '../components/Hero';
import Details from '../components/Details';
import Schedule from '../components/Schedule';
import Travel from '../components/Travel';
import RSVPSection from '../components/RSVPSection';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <div>
      <Hero />
      <Details />
      <Schedule />
      <Travel />
      <RSVPSection />
      <Footer />
    </div>
  );
}
