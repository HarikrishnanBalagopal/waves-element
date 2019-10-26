import vertexShaderSource from './shaders/vertex-shader.vert';
import fragmentShaderSource from './shaders/fragment-shader.frag';

const cout = console.log.bind(console);
const sel = document.querySelector.bind(document);

function main()
{
    const img_slack_logo = sel('#img-slack-logo');
    img_slack_logo.onload = init;
}

function peak(uv, pos, size)
{
    const dx = uv.x - pos.x, dy = uv.y - pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return Math.exp(- size * d);
}

function calculate_initial_condition(R, C)
{
    const arr = new Float32Array(R * C * 2);
    const peak_pos = {x: 0.5, y: 0.5};
    const peak_size = 10;
    for(let r = 1; r < R - 1; r++)
    {
        for(let c = 1; c < C - 1; c++)
        {
            const i = 2 * (r * C + c);
            const uv = {x: (c / R), y: (r/ R)};
            arr[i] = 0; // velocity
            arr[i + 1] = peak(uv, peak_pos, peak_size); // position
        }
    }
    return arr;
}

function init() {
    const img_slack_logo = sel('#img-slack-logo');
    const initial_condition = calculate_initial_condition(256, 256);
    //cout('vertexShaderSource:', vertexShaderSource);
    //cout('fragmentShaderSource:', fragmentShaderSource);
    const canvas = document.querySelector('#webgl-canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('no webgl2 support');
        return;
    }

    // Compile and link shader program.
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Get locations from shader program.
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const imageLocation = gl.getUniformLocation(program, 'u_image');

    // configure texture.
    const texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    //cout(gl.TEXTURE_2D, mipLevel, internalFormat, srcFormat, srcType, initial_condition);
    const mipLevel = 0, internalFormat = gl.RG32F, texWidth = 256, texHeight = 256, texBorder = 0, srcFormat = gl.RG, srcType = gl.FLOAT;
    gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, texWidth, texHeight, texBorder, srcFormat, srcType, initial_condition);

    // upload rectangle coords.
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
        -1, -1,
        -1, 1,
        1, 1,
        1, 1,
        1, -1,
        -1, -1
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);
    const size = 2, type = gl.FLOAT, normalize = false, stride = 0, offset = 0;
    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

    // clear viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // render
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform1i(imageLocation, 0);
    const primitiveType = gl.TRIANGLES, offset1 = 0, count1 = 6;
    gl.drawArrays(primitiveType, offset1, count1);
}

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) return shader;
    cout('failed to compile the shader:', type);
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) return program;
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

main();