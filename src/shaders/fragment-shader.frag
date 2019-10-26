#version 300 es

precision mediump float;

uniform sampler2D u_image;

out vec4 fragColor;

float sigmoid(float x)
{
    return 1. / (1. + exp(-x));
}

vec3 floatToRgb(float v, float scale) {
    float r = v;
    float g = mod(v*scale,1.0);
    r-= g/scale;
    float b = mod(v*scale*scale,1.0);
    g-=b/scale;
    return vec3(r,g,b);
}

void main()
{
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 iResolution = vec2(256., 256.);

    // get current x and y.
    fragCoord -= 0.5; // pixel coordinates are given as mid intergers, subtract 0.5 to make it interger.
    ivec2 center = ivec2(fragCoord);
    ivec2 res    = ivec2(iResolution) - 1;

    float pos = texelFetch(u_image, center, 0).y;

    // vec3 col = floatToRgb(pos, 256.);
    vec3 col = vec3(sigmoid(pos), sin(pos), cos(pos));
    // vec3 col = vec3(sigmoid(pos));

    fragColor = vec4(col, 1.0);
}
