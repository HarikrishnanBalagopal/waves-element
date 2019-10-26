#version 300 es

precision mediump float;

uniform sampler2D u_image;

out vec4 outColor;

float circle(vec2 center, float radius, vec2 uv)
{
  float d = length(uv - center);
  return smoothstep(radius, radius - 0.01, d);
}

float sat(float x)
{
  return clamp(x, 0., 1.);
}
vec2 sat(vec2 x)
{
  return clamp(x, 0., 1.);
}
vec3 sat(vec3 x)
{
  return clamp(x, 0., 1.);
}

float mouth(vec2 center, float radius, vec2 uv)
{
  float mask = 0.;
  uv -= center;
  mask += circle(vec2(0.), radius, uv);
  mask -= circle(vec2(0., 0.1 * radius), radius, uv);
  return sat(mask);
}

float smiley(vec2 center, float size, vec2 uv)
{
  float mask = 0.;
  uv -= center;
  uv /= size;
  mask += circle(vec2(0.), .5, uv);
  mask -= circle(vec2(-0.2, 0.2), .1, uv);
  mask -= circle(vec2(0.2), .1, uv);
  mask -= mouth(vec2(0., -0.1), .3, uv);
  return mask;
}

void main()
{
  vec2 resolution = vec2(256., 256.);
  vec2 xy = gl_FragCoord.xy - 0.5;
  vec2 uv = xy/resolution;
  vec3 uv_rainbow = vec3(uv, 1.);
  uv -= 0.5;
  uv.x *= resolution.x/resolution.y;

  float mask = 0.;
  mask += smiley(vec2(0.2, 0.), 0.2, uv);
  mask += smiley(vec2(-0.2, 0.), 0.2, uv);

  vec3 black = vec3(0.);
  vec3 red = vec3(1., 0., 0.);
  vec3 col = black;
  vec3 image = texture(u_image, uv_rainbow.xy).xyz;
  col = mix(col, image, mask);
  outColor = vec4(col, 1.);
}
