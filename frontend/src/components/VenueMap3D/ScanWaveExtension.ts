import { LayerExtension } from "@deck.gl/core";
import type { ShaderModule } from "@luma.gl/shadertools";

type ScanProps = {
  centerLngLat: [number, number];
  radiusMeters: number;
  widthMeters: number;
  glow: number;
  colorRgb: [number, number, number];
  alpha: number;
};

const scanUniforms = {
  name: "scan",
  // We only need to declare uniforms; shaderInject will place code
  fs: "",
  uniformTypes: {
    centerLngLat: "vec2<f32>",
    radiusMeters: "f32",
    widthMeters: "f32",
    glow: "f32",
    colorRgb: "vec3<f32>",
    alpha: "f32",
  },
} as const satisfies ShaderModule<ScanProps>;

export class ScanWaveExtension extends LayerExtension {
  static extensionName = 'ScanWaveExtension';

  getShaders(this: any, extension: this) {
    const shaders = super.getShaders?.(extension) || {};

    return {
      ...shaders,
      inject: {
        // Declare uniform ONCE at global scope
        'fs:#decl': `
uniform float scanRadiusMeters;
uniform vec3 scanColorRgb;
        `,

        // Inject pulse logic
        'fs:DECKGL_FILTER_COLOR': `
float r = fract(scanRadiusMeters * 0.00005);

float ring =
  smoothstep(r - 0.01, r, geometry.uv.x) -
  smoothstep(r, r + 0.01, geometry.uv.x);

color.rgb = mix(color.rgb, scanColorRgb, ring);
color.a = 1.0;
        `,
      },
    };
  }

  draw({ uniforms, props }: any) {
    uniforms.scanRadiusMeters = props.scanRadiusMeters ?? 0;
    uniforms.scanColorRgb = props.scanColorRgb ?? [0.3, 1.0, 0.7];
  }
}
