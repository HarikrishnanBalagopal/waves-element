#version 300 es

precision highp float;

uniform sampler2D i_image;
uniform bool is_velocity_update;
uniform float iTimeDelta;
uniform ivec3 iMouse;

out vec4 fragColor;

#define SPRING_CONSTANT .01
#define PROP_SPEED 1.
#define MASS 10.
#define FRICTION_COEFF 0.005
#define PEAK_SIZE .05
#define MAX_ACCELERATION_MAGNITUDE 1.
#define MAX_VELOCITY_MAGNITUDE 10.
#define MAX_DISPLACEMENT 64.

float sigmoid(float x)
{
    return 1. / (1. + exp(-x));
}

/*
float peak(ivec2 center, ivec2 pos, float size)
{
    center -= pos;
    float d = length(vec2(center));
    return smoothstep(20., 10., d);
}
*/

float peak(ivec2 center, ivec2 pos, float size)
{
    float d = length(vec2(center) - vec2(pos));
    float e = exp(-size * d);
    return e;
}

void main()
{
    vec2 fragCoord = gl_FragCoord.xy;
    vec2 iResolution = vec2(256., 256.);

    // get current x and y.
    fragCoord -= 0.5; // pixel coordinates are given as mid intergers, subtract 0.5 to make it interger.
    ivec2 center = ivec2(fragCoord);
    ivec2 res    = ivec2(iResolution) - 1;

    // if it is a boundary cell set everything to 0.
    if(center.x == 0 || center.y == 0 || center.x == res.x || center.y == res.y)
    {
        fragColor = vec4(vec3(0.), 1.0);
        return;
    }

    ivec2 left   = center + ivec2(-1,  0);
    ivec2 top    = center + ivec2( 0,  1);
    ivec2 right  = center + ivec2( 1,  0);
    ivec2 bottom = center + ivec2( 0, -1);

    // get data of center and neighbouring cells.
	vec3 data_c = texelFetch(i_image, center, 0).xyz;

	vec3 data_l = texelFetch(i_image, left  , 0).xyz;
	vec3 data_t = texelFetch(i_image, top   , 0).xyz;
	vec3 data_r = texelFetch(i_image, right , 0).xyz;
	vec3 data_b = texelFetch(i_image, bottom, 0).xyz;

    float pos_c = data_c.x;

    float pos_l = data_l.x;
    float pos_t = data_t.x;
    float pos_r = data_r.x;
    float pos_b = data_b.x;

    float vel = data_c.y;
    float acc = data_c.z;

    if(is_velocity_update)
    {
        // UPDATE 1

        vel = (1. - FRICTION_COEFF) * vel + acc * iTimeDelta * 0.5 * PROP_SPEED;
        pos_c = pos_c + vel * iTimeDelta * PROP_SPEED;

        data_c = vec3(pos_c, vel, acc);
    }
    else
    {
        // UPDATE 2

        // get 3d positions.
        vec3 pos_cv = vec3(vec2(center), pos_c);
 
        vec3 pos_lv = vec3(vec2(left  ), pos_l);
        vec3 pos_tv = vec3(vec2(top   ), pos_t);
        vec3 pos_rv = vec3(vec2(right ), pos_r);
        vec3 pos_bv = vec3(vec2(bottom), pos_b);

        // calculate total force using Hooke's law.
        vec3 force_l = (pos_lv - pos_cv);
        vec3 force_t = (pos_tv - pos_cv);
        vec3 force_r = (pos_rv - pos_cv);
        vec3 force_b = (pos_bv - pos_cv);

        force_l = normalize(force_l) * (length(force_l) - 1.) * SPRING_CONSTANT;
        force_t = normalize(force_t) * (length(force_t) - 1.) * SPRING_CONSTANT;
        force_r = normalize(force_r) * (length(force_r) - 1.) * SPRING_CONSTANT;
        force_b = normalize(force_b) * (length(force_b) - 1.) * SPRING_CONSTANT;

        // gravity
        vec3 force_g = vec3(0.); // ZERO GRAVITY
        // vec3 force_g = vec3(0., 0., -0.001 * MASS); // VERY LOW GRAVITY
        // vec3 force_g = vec3(0., 0., -1.62 * MASS); // MOON
        // vec3 force_g = vec3(0., 0., -9.807 * MASS); // EARTH

        vec3 total_force = force_l + force_t + force_r + force_b + force_g;

        // calculate acceleration and velocity.
        acc = total_force.z / MASS;
        vel = (1. - FRICTION_COEFF) * vel + acc * iTimeDelta * 0.5 * PROP_SPEED;

         // if LMB is down insert a peak at the click position.
        ivec2 click = iMouse.xy;
        if(iMouse.z == 1)pos_c += peak(center, click, PEAK_SIZE);

        data_c = vec3(pos_c, vel, acc);
        data_c.x -= sin(pos_c / 100.);

        // data_c = 0.2 * (data_c + data_l + data_r + data_t + data_b);
    }

    // clamp values.
    vec3 bounds = vec3(MAX_DISPLACEMENT, MAX_VELOCITY_MAGNITUDE, MAX_ACCELERATION_MAGNITUDE);
    data_c = clamp(data_c, -bounds, bounds);
    // acc = clamp(acc, -MAX_ACCELERATION_MAGNITUDE, MAX_ACCELERATION_MAGNITUDE);
    // if(abs(acc) > MAX_ACCELERATION_MAGNITUDE)acc = 0.;
    // if(acc < -MAX_ACCELERATION_MAGNITUDE)acc = 0.;
    // vel = clamp(vel, -MAX_VELOCITY_MAGNITUDE, MAX_VELOCITY_MAGNITUDE);
    // if(abs(vel) > MAX_VELOCITY_MAGNITUDE)vel *= -1.;
    // if(abs(vel) > MAX_VELOCITY_MAGNITUDE)vel = 0.;
    // if(vel < -MAX_VELOCITY_MAGNITUDE)vel = 0.;
    // pos_c = clamp(pos_c, -MAX_DISPLACEMENT, MAX_DISPLACEMENT);
    /*
    if(abs(pos_c) > MAX_DISPLACEMENT)
    {
        pos_c = 0.25 * (pos_t + pos_b + pos_l + pos_r);
    }
    // if(pos_c < -MAX_DISPLACEMENT)pos_c = 0.;
    if(abs(pos_c) > MAX_DISPLACEMENT || abs(vel) > MAX_VELOCITY_MAGNITUDE || abs(acc) > MAX_ACCELERATION_MAGNITUDE)
    {
        pos_c =  clamp(pos_c, -MAX_DISPLACEMENT, MAX_DISPLACEMENT);
        vel *= -1.;
        acc = 0.;
    }
    */

    // output current velocity and current position.
    fragColor = vec4(data_c, 1.0);
}

/*


float screen_center_dist(ivec2 pos)
{
    ivec2 screen_center = ivec2(iResolution) / 2;
    float d = length(vec2(pos) - vec2(screen_center));
    return sigmoid(d);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{

}
*/

/*


void mainImage(out vec4 fragColor, in vec2 fragCoord)
{

}
*/