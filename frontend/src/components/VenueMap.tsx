import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import L from 'leaflet';
import PulseScan from './VenueMap/PulseScan';

const position: [number, number] = [56.5, -5.5]; // replace with real coords

export default function VenueMap() {
  const pulseIcon = L.divIcon({
    className: 'pulse-marker',
  });

  return (
    <section className="py-20 px-6 text-center bg-neutral-100">
      <h2 className="text-3xl font-serif mb-8">Location</h2>

      <div className="h-[400px] w-full max-w-4xl mx-auto rounded-2xl overflow-hidden shadow-lg">
        <MapContainer center={position} zoom={7} scrollWheelZoom={false} className="h-full w-full">
          {/* 🌌 Elegant basemap */}
          <TileLayer url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png" />

          {/* 📍 Marker */}
          <Marker position={position} icon={pulseIcon} />

          <PulseScan center={position} />
        </MapContainer>
      </div>
    </section>
  );
}
