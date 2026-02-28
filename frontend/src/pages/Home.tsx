import Hero from '../components/Hero';
import Details from '../components/Details';
import Schedule from '../components/Schedule';
import Travel from '../components/Travel';
import RSVPSection from '../components/RSVPSection';
import Footer from '../components/Footer';
// import VenueMap from "../components/VenueMap";
import VenueMap3DScan from '../components/VenueMap3D/VenueMap3DScan';

export default function Home() {
  return (
    <div>
      <Hero />
      <Details />
      {/* <VenueMap /> */}
      <VenueMap3DScan />
      <Schedule />
      <Travel />
      <RSVPSection />
      <Footer />
    </div>
  );
}
