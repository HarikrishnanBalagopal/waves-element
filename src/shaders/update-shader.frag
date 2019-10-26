#version 300 es

precision mediump float;

uniform sampler2D i_image;
uniform bool is_velocity_update;

out vec4 outColor;

float sigmoid(float x)
{
    return 1. / (1. + exp(-x));
}

void main()
{
  ivec2 center = ivec2(gl_FragCoord.xy - 0.5);

  vec2 vel_pos = texelFetch(i_image, center, 0).xy;
  vel_pos.y += is_velocity_update ? 0.0005 : 0.;

  outColor = vec4(vel_pos, 0., 1.);
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
    // UPDATE VELOCITIES
    // Channel 0 is previous velocities (x coordinate) and previous positions (y coordinate).

    // get current x and y.
    fragCoord -= 0.5; // pixel coordinates are given as mid intergers, subtract 0.5 to make it interger.
    ivec2 center = ivec2(fragCoord);
    ivec2 res    = ivec2(iResolution) - 1;

    // if it is a boundary cell velocity is 0.
    if(center.x == 0 || center.y == 0 || center.x == res.x || center.y == res.y)
    {
        fragColor = vec4(vec3(0.), 1.0);
        return;
    }

    ivec2 left   = center + ivec2(-1,  0);
    ivec2 top    = center + ivec2( 0,  1);
    ivec2 right  = center + ivec2( 1,  0);
    ivec2 bottom = center + ivec2( 0, -1);

    // get previous z coordinate of current cell and neighbour cells.
	float pos_c = texelFetch(iChannel0, center, 0).y;

	float pos_l = texelFetch(iChannel0, left  , 0).y;
	float pos_t = texelFetch(iChannel0, top   , 0).y;
	float pos_r = texelFetch(iChannel0, right , 0).y;
	float pos_b = texelFetch(iChannel0, bottom, 0).y;

    // get previous velocity of current cell.
	float vel   = texelFetch(iChannel0, center, 0).x;

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
    vec3 force_g = vec3(0., 0., -0.001 * MASS); // VERY LOW GRAVITY
    // vec3 force_g = vec3(0., 0., -1.62 * MASS); // MOON
    // vec3 force_g = vec3(0., 0., -9.807 * MASS); // EARTH

    vec3 total_force = force_l + force_t + force_r + force_b + force_g;

    // calculate acceleration and velocity.
    float acc = total_force.z / MASS;
    vel = (1. - FRICTION_COEFF) * vel + acc * iTimeDelta * PROP_SPEED;
    //vel = (1. - FRICTION_COEFF * screen_center_dist(center)) * vel + acc * iTimeDelta * PROP_SPEED;

    // clamp velocity.
    vel = clamp(vel, -MAX_VELOCITY_MAGNITUDE, MAX_VELOCITY_MAGNITUDE);

    // output current velocity and previous position.
    fragColor = vec4(vel, pos_c, 0., 1.0);
}
*/

/*
float peak(ivec2 center, ivec2 pos, float size)
{
    float d = length(vec2(center) - vec2(pos));
    float e = exp(-size * d);
    return e;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    // UPDATE POSITIONS
    // Channel 0 is previous velocities (x coordinate) and previous positions (y coordinate).

    // get current x and y.
    fragCoord -= 0.5; // pixel coordinates are given as mid intergers, subtract 0.5 to make it interger.
    ivec2 center = ivec2(fragCoord);
    ivec2 res    = ivec2(iResolution) - 1;

    // if it is a boundary cell position is 0.
    if(center.x == 0 || center.y == 0 || center.x == res.x || center.y == res.y)
    {
        fragColor = vec4(vec3(0.), 1.0);
        return;
    }

    // initial conditon is a peak at (128, 128).
    if(iFrame < 30)
    {
	    //fragColor = vec4(vec3(0.), 1.0);
        float pos = texelFetch(iChannel1, center, 0).r;
	    fragColor = 10. * vec4(0., pos, 0., 1.0);

        //float pos = 10. * peak(center, ivec2(128, 128), PEAK_SIZE);
	    //fragColor = vec4(0., pos, 0., 1.0);
        return;
    }

    // get current velocity and previous position.
	float vel = texelFetch(iChannel0, center, 0).x;
	float pos = texelFetch(iChannel0, center, 0).y;

    // calculate new position.
    pos = pos + vel * iTimeDelta * PROP_SPEED;

    // if LMB is down insert a peak at the click position.
    ivec2 click = ivec2(iMouse.xy);
    if(iMouse.z > 0.)pos += 10. * peak(center, click, PEAK_SIZE);

    // clamp the position.
    pos = clamp(pos, -MAX_DISPLACEMENT, MAX_DISPLACEMENT);

    // output current velocity and current position.
    fragColor = vec4(vel, pos, 0., 1.0);
}
*/