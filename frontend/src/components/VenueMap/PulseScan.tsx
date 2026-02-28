import { useEffect, useState } from 'react';
import { Circle } from 'react-leaflet';

export default function PulseScan({ center }: { center: [number, number] }) {
  const [radius, setRadius] = useState(100);

  useEffect(() => {
    let frame: number;

    const animate = () => {
      setRadius((r) => (r > 4000 ? 100 : r + 40));
      frame = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <Circle
      center={center}
      radius={radius}
      pathOptions={{
        color: '#22c55e',
        weight: 1,
        opacity: 0.6,
        fillOpacity: 0.05,
      }}
    />
  );
}
