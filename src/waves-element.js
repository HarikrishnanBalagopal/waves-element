import { LitElement, html, css } from 'lit-element';
import vertexShaderSource from './shaders/vertex-shader.vert';
import fragmentShaderSource from './shaders/fragment-shader.frag';
import updateShaderSource from './shaders/update-shader.frag';

const cout = console.log.bind(console);

function peak(uv, pos, size)
{
    const dx = uv.x - pos.x, dy = uv.y - pos.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    return Math.exp(- size * d);
}

function calculate_initial_condition(R, C)
{
    // The initial condition is a peak at the center of the screen.
    const element_per_cell = 4;
    const arr = new Float32Array(R * C * element_per_cell);
    const peak_pos = {x: 0.5, y: 0.5};
    const peak_size = 10;
    for(let r = 1; r < R - 1; r++)
    {
        for(let c = 1; c < C - 1; c++)
        {
            const i = element_per_cell * (r * C + c);
            const uv = {x: (c / R), y: (r/ R)};
            arr[i] = peak(uv, peak_pos, peak_size); // 1st element is the position.
        }
    }
    return arr;
}

function init(canvas)
{
    const initial_condition = calculate_initial_condition(256, 256);

    const gl = canvas.getContext('webgl2');

    if (!gl) {
        alert('No webgl2 support on your device!!');
        return;
    }

    const ext = (gl.getExtension('EXT_color_buffer_float'));
    if (!ext) {
        alert('No support for rendering to floating point textures on your device!!');
        return;
    }

    // Compile all the shaders.
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const updateShader = createShader(gl, gl.FRAGMENT_SHADER, updateShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

    // Create and link all shader programs.
    const updateProgram = createProgram(gl, vertexShader, updateShader);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // Get locations of shader inputs.
    const positionAttributeLocation = gl.getAttribLocation(program, 'a_position');
    const isVelocityUpdateLocation = gl.getUniformLocation(updateProgram, 'is_velocity_update');
    const updateImageLocation = gl.getUniformLocation(updateProgram, 'i_image');
    const iTimeDeltaLocation = gl.getUniformLocation(updateProgram, 'iTimeDelta');
    const iMouseLocation = gl.getUniformLocation(updateProgram, 'iMouse');
    const imageLocation = gl.getUniformLocation(program, 'u_image');

    // Configure texture 1.
    const texture1 = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    const mipLevel = 0, internalFormat = gl.RGBA32F, texWidth = 256, texHeight = 256, texBorder = 0, srcFormat = gl.RGBA, srcType = gl.FLOAT, texNumElements = 4;
    gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, texWidth, texHeight, texBorder, srcFormat, srcType, initial_condition);

    // Configure texture 2.
    const texture2 = gl.createTexture();
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    gl.texImage2D(gl.TEXTURE_2D, mipLevel, internalFormat, texWidth, texHeight, texBorder, srcFormat, srcType, new Float32Array(texWidth * texHeight * texNumElements));

    // Create a framebuffer for rendering to texture.
    const attachmentPoint = gl.COLOR_ATTACHMENT0;
    const frameBuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture2, 0);

    // Check framebuffer status and report errors.
    const frameBufferStatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    /*
    const statuses = {
        [gl.FRAMEBUFFER_COMPLETE]: 'complete',
        [gl.FRAMEBUFFER_INCOMPLETE_ATTACHMENT]: 'incomplete attachment',
        [gl.FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT]: 'missing attachment',
        [gl.FRAMEBUFFER_INCOMPLETE_DIMENSIONS]: 'height and width of attachment are not the same',
        [gl.FRAMEBUFFER_UNSUPPORTED]: 'format of the attachedment is not supported or some other conditions',
        [gl.FRAMEBUFFER_INCOMPLETE_MULTISAMPLE]: 'the values of gl.RENDERBUFFER_SAMPLES are different among different attached renderbuffers or are non zero if attached images are a mix of render buffers and textures'
    };
    cout('framebuffer status:', frameBufferStatus, statuses[frameBufferStatus]);
    */
    if(frameBufferStatus != gl.FRAMEBUFFER_COMPLETE)
    {
        alert('Failed to create a framebuffer!!');
        return;
    }

    // Upload rectangle coordinates.
    const positions = [
        -1, -1,
        -1,  1,
         1,  1,
         1,  1,
         1, -1,
        -1, -1
    ];
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Create a VAO to read the position data.
    const size = 2, type = gl.FLOAT, normalize = false, stride = 0, offset = 0;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);
    gl.vertexAttribPointer(positionAttributeLocation, size, type, normalize, stride, offset);

    // Data to handle mouse events.
    const mouseData = {mouse_x: 0, mouse_y: 0, mouse_updated: false, is_dragging: false};

    canvas.addEventListener('mousedown', e => {
        mouseData.is_dragging = true;
        const rect = e.target.getBoundingClientRect();
        mouseData.mouse_x = Math.floor(e.clientX - rect.left); //x position within the element.
        mouseData.mouse_y = Math.floor(rect.bottom - e.clientY);  //y position within the element.
        mouseData.mouse_updated = true;
        // cout(mouseData.mouse_x, mouseData.mouse_y, mouseData.mouse_updated);    
    });
    canvas.addEventListener('mousemove', e => {
        if(mouseData.is_dragging)
        {
            const rect = e.target.getBoundingClientRect();
            mouseData.mouse_x = Math.floor(e.clientX - rect.left); //x position within the element.
            mouseData.mouse_y = Math.floor(rect.bottom - e.clientY);  //y position within the element.
            mouseData.mouse_updated = true;
            // cout(mouseData.mouse_x, mouseData.mouse_y, mouseData.mouse_updated);    
        }
    });
    canvas.addEventListener('mouseup', () => {
        mouseData.is_dragging = false;
    });
    canvas.addEventListener('mouseleave', () => {
        mouseData.is_dragging = false;
    });
    // Arguments passed to update step.
    const args = {
        gl, program, attachmentPoint, updateProgram, vao, iMouseLocation, iTimeDeltaLocation, isVelocityUpdateLocation, imageLocation, updateImageLocation, frameBuffer, texture1, texture2, prev: 0, mouseData
    };
    window.requestAnimationFrame(step.bind(null, args));
}

function step(args, timestamp)
{
    // Update velocities and positions and render a single frame.

    const {
        gl, program, attachmentPoint, updateProgram, vao, iMouseLocation, iTimeDeltaLocation, isVelocityUpdateLocation, imageLocation, updateImageLocation, frameBuffer, texture1, texture2, prev, mouseData
    } = args;
    const deltaTime = timestamp - prev;

    // Run the update program for veloctiy update.
    gl.useProgram(updateProgram);
    gl.uniform1i(isVelocityUpdateLocation, 1);
    gl.uniform1f(iTimeDeltaLocation, deltaTime);
    gl.uniform3i(iMouseLocation, mouseData.mouse_x, mouseData.mouse_y, mouseData.mouse_updated ? 1 : 0);
    render(gl, updateProgram, vao, updateImageLocation, 0, frameBuffer);

    // Swap textures.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture1, 0);

    // Run the update program for position update.
    gl.useProgram(updateProgram);
    gl.uniform1i(isVelocityUpdateLocation, 0);
    render(gl, updateProgram, vao, updateImageLocation, 0, frameBuffer);

    // Swap textures again.
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, texture2);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, texture2, 0);

    // Run the render program.
    render(gl, program, vao, imageLocation, 0, null);

    mouseData.mouse_updated = false;
    window.requestAnimationFrame(step.bind(null, {...args, prev: timestamp}));
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

function createShader(gl, type, source)
{
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if(success)return shader;

    cout('Failed to compile the shader:', type);
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader)
{
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    const success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if(success)return program;

    cout('Failed to compile the shader program.');
    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

export class WavesElement extends LitElement
{
    static get styles()
    {
        return css`
            /* Selects the host element */
            :host { display: inline-block;}
            /* Selects the host element if it is hidden */
            :host([hidden]) { display: none; }
        `;
    }
    constructor()
    {
        super();
        this.setupCanvas();
    }
    async setupCanvas()
    {
        await this.updateComplete;

        const canvas = this.shadowRoot.getElementById('webgl-canvas');
        init(canvas);
    }
    render()
    {
        return html`
            <canvas id="webgl-canvas" width="256" height="256"></canvas>
        `;
    }
}

customElements.define('waves-element', WavesElement);