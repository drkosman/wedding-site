import Map, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

export default function VenueMap3D() {
  return (
    <section className="py-20 px-6 text-center bg-neutral-900">
      <h2 className="text-3xl font-serif mb-8 text-white">Location</h2>

      <div className="h-[500px] w-full max-w-5xl mx-auto rounded-2xl overflow-hidden shadow-lg">
        <Map
          initialViewState={{
            longitude: -5.5,
            latitude: 56.5,
            zoom: 9,
            pitch: 60, // tilt for 3D effect
            bearing: -20,
          }}
          mapStyle="https://demotiles.maplibre.org/style.json"
          style={{ width: '100%', height: '100%' }}
        >
          {/* Terrain source */}
          <Source
            id="terrain"
            type="raster-dem"
            url="https://demotiles.maplibre.org/terrain-tiles/tiles.json"
            tileSize={256}
          />

          {/* Enable terrain */}
          <Layer id="terrain-layer" type="hillshade" source="terrain" />
        </Map>
      </div>
    </section>
  );
}
