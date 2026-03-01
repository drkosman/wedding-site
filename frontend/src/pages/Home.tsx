import Hero from '../components/Hero';
import Details from '../components/Details';
import Schedule from '../components/Schedule';
import Travel from '../components/Travel';
import RSVPSection from '../components/RSVPSection';
import Footer from '../components/Footer';
import Map from '../components/Map'

export default function Home() {
  return (
    <div>
      <Hero />
      <Map />
      <Details />
      <Schedule />
      <Travel />
      <RSVPSection />
      <Footer />
    </div>
  );
}
