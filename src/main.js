import vertexShaderSource from './shaders/vertex-shader.vert';
import fragmentShaderSource from './shaders/fragment-shader.frag';
import updateShaderSource from './shaders/update-shader.frag';

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
            arr[i + 1] = peak(uv, peak_pos, peak_size); // position
        }
    }
    return arr;
}

function init() {
    //const img_slack_logo = sel('#img-slack-logo');
    const initial_condition = calculate_initial_condition(256, 256);
    //cout('vertexShaderSource:', vertexShaderSource);
    //cout('fragmentShaderSource:', fragmentShaderSource);
    const canvas = document.querySelector('#webgl-canvas');
    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('no webgl2 support');
        return;
    }

    const ext = (gl.getExtension('EXT_color_buffer_float'));
    //cout(ext);

    // Compile and link rendering shader program.
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const updateShader = createShader(gl, gl.FRAGMENT_SHADER, updateShaderSource);
    const updateProgram = createProgram(gl, vertexShader, updateShader);

    // Compile and link rendering shader program.
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Get locations from shader program.
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const isVelocityUpdateLocation = gl.getUniformLocation(updateProgram, 'is_velocity_update');
    const updateImageLocation = gl.getUniformLocation(updateProgram, 'i_image');
    const imageLocation = gl.getUniformLocation(program, 'u_image');

    // configure texture 1.
    const texture1 = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    //cout(gl.TEXTURE_2D, mipLevel, internalFormat, srcFormat, srcType, initial_condition);
    const mipLevel = 0, internalFormat = gl.RG32F, texWidth = 256, texHeight = 256, texBorder = 0, srcFormat = gl.RG, srcType = gl.FLOAT;
    gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, texWidth, texHeight, texBorder, srcFormat, srcType, initial_condition);

    // configure texture 2.
    const texture2 = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, texWidth, texHeight, texBorder, srcFormat, srcType, new Float32Array(256 * 256 * 2));

    // create framebuffer for rendering to texture.
    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture2, 0);
    const frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    const statuses = {
        [gl.FRAMEBUFFER_COMPLETE]: 'complete',
        [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'incomplete attachment',
        [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'missing attachment',
        [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'height and width of attachment are not the same',
        [gl.FRAMEBUFFER_UNSUPPORTED]: 'format of the attachedment is not supported or some other conditions',
        [gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]: 'the values of gl.RENDERBUFFER_SAMPLES are different among different attached renderbuffers or are non zero if attached images are a mix of render buffers and textures'
    };
    cout('framebuffer status:', frameBufferStatus, statuses[frameBufferStatus]);

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

    const args = {
        gl, program, attachmentPoint, updateProgram, vao, isVelocityUpdateLocation, imageLocation, updateImageLocation, frameBuffer, texture1, texture2
    };
    window.requestAnimationFrame(step.bind(null, args));
}

function step(args)
{
    const {
        gl, program, attachmentPoint, updateProgram, vao, isVelocityUpdateLocation, imageLocation, updateImageLocation, frameBuffer, texture1, texture2
    } = args;

    // run the update program for veloctiy update.
    gl.useProgram(updateProgram);
    gl.uniform1i(isVelocityUpdateLocation, 1);
    render(gl, updateProgram, vao, updateImageLocation, 0, frameBuffer);

    // swap textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture1, 0);

    // run the update program for position update.
    gl.useProgram(updateProgram);
    gl.uniform1i(isVelocityUpdateLocation, 0);
    render(gl, updateProgram, vao, updateImageLocation, 0, frameBuffer);

    // swap textures
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture2, 0);

    // run render program
    render(gl, program, vao, imageLocation, 0, null);

    window.requestAnimationFrame(step.bind(null, args));
}

function render(gl, program, vao, imageLocation, texture, frameBuffer)
{
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    // clear viewport
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // render
    gl.useProgram(program);
    gl.bindVertexArray(vao);
    gl.uniform1i(imageLocation, texture);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
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