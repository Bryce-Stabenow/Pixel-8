//Sets state for project to contain actions needed for the updating of pixel editor - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class Picture {
	//Creates props for size of editor
	constructor(width, height, pixels) {
		this.width = width;
		this.height = height;
		//Pixels is stored as an array
		this.pixels = pixels;
	}
	static empty(width, height, color) {
		//creates new array using width + height that is .fill(ed) with the given color values in HEX
		let pixels = new Array(width * height).fill(color);
		return new Picture(width, height, pixels);
	}
	pixel(x, y) {
		return this.pixels[x + y * this.width];
	}
	draw(pixels) {
		let copy = this.pixels.slice();
		for (let { x, y, color } of pixels) {
			copy[x + y * this.width] = color;
		}
		return new Picture(this.width, this.height, copy);
	}
}

//Sets up functions for updating DOM with javascipt events - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
const scale = 10;

function changePX(type, props, ...children) {
	let dom = document.createElement(type);
	if (props) Object.assign(dom, props);

	for (let child of children) {
		if (typeof child != 'string') {
			dom.appendChild(child);
		} else {
			dom.appendChild(document.createTextNode(child));
		}
	}
	return dom;
}

function pointerPosition(pos, domNode) {
	let rect = domNode.getBoundingClientRect();
	return {
		x: Math.floor((pos.clientX - rect.left) / scale),
		y: Math.floor((pos.clientY - rect.top) / scale),
	};
}

//This is the object for the actual pixels themselves which will be sending information to and from the DOM
class PictureCanvas {
	constructor(picture, pointerDown) {
		this.dom = changePX('canvas', {
			onmousedown: (event) => this.mouse(event, pointerDown),
			ontouchstart: (event) => this.touch(event, pointerDown),
		});
		this.syncState(picture);
	}
	syncState(picture) {
		if (this.picture == picture) return;
		this.picture = picture;
		drawPicture(this.picture, this.dom, scale);
	}
	//Adds functionality to send information from DOM to the js file to use later USING MOUSE CLICKS
	mouse(downEvent, onDown) {
		if (downEvent.button != 0) {
			return;
		}
		let pos = pointerPosition(downEvent, this.dom);
		let onMove = onDown(pos);
		if (!onMove) {
			return;
		}
		let move = (moveEvent) => {
			if (moveEvent.buttons === 0) {
				this.dom.removeEventListener('mousemove', move);
			} else {
				let newPos = pointerPosition(moveEvent, this.dom);
				if (newPos.x == pos.x && newPos.y == pos.y) {
					return;
				}
				pos = newPos;
				onMove(newPos);
			}
		};
		this.dom.addEventListener('mousemove', move);
	}
	//Adds functionality to send information from DOM to the js file to use later USING TOUCH INTERFACE FOR MOBILE
	touch(startEvent, onDown) {
		let pos = pointerPosition(startEvent.touches[0], this.dom);
		let onMove = onDown(pos);
		startEvent.preventDefault();
		if (!onMove) {
			return;
		}
		let move = (moveEvent) => {
			let newPos = pointerPosition(moveEvent.touches[0], this.dom);
			if (newPos.x == pos.x && newPos.y == pos.y) {
				return;
			}
			pos = newPos;
			onMove(newPos);
		};
		let end = () => {
			this.dom.removeEventListener('touchmove', move);
			this.dom.removeEventListener('touchend', end);
		};
		this.dom.addEventListener('touchmove', move);
		this.dom.addEventListener('touchend', end);
	}
}
//Function for drawing the new picture to the canvas when the canvas is synced up!
function drawPicture(picture, canvas, scale) {
	canvas.width = picture.width * scale;
	canvas.height = picture.height * scale;
	let cx = canvas.getContext('2d');

	for (let y = 0; y < picture.height; y++) {
		for (let x = 0; x < picture.width; x++) {
			cx.fillStyle = picture.pixel(x, y);
			cx.fillRect(x * scale, y * scale, scale, scale);
		}
	}
}

//Application settings for the actual canvas and toolbelt section of the app - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
class PixelEditor {
	constructor(state, config) {
		let { tools, controls, dispatch } = config;
		this.state = state;

		this.canvas = new PictureCanvas(state.picture, (pos) => {
			let tool = tools[this.state.tool];
			let onMove = tool(pos, this.state, dispatch);
			if (onMove) {
				return (pos) => onMove(pos, this.state);
			}
		});
		this.controls = controls.map((Control) => new Control(state, config));
		this.dom = changePX(
			'div',
			{},
			this.canvas.dom,
			changePX('br'),
			...this.controls.reduce((a, c) => a.concat(' ', c.dom), [])
		);
	}
	syncState(state) {
		this.state = state;
		this.canvas.syncState(state.picture);
		for (let ctrl of this.controls) {
			ctrl.syncState(state);
		}
	}
}
//Code for the tool selection button below the pixel editor
class ToolSelect {
	constructor(state, { tools, dispatch }) {
		this.select = changePX(
			'select',
			{
				onchange: () => dispatch({ tool: this.select.value }),
			},
			...Object.keys(tools).map((name) =>
				changePX(
					'option',
					{
						selected: name == state.tool,
					},
					name
				)
			)
		);
		this.dom = changePX('label', null, 'Tool: ', this.select);
	}
	syncState(state) {
		this.select.value = state.tool;
	}
}
//Code for the color picker next to the tool element
class ColorSelect {
	constructor(state, { dispatch }) {
		this.input = changePX('input', {
			type: 'color',
			value: state.color,
			onchange: () => dispatch({ color: this.input.value }),
		});
		this.dom = changePX('label', null, 'Color: ', this.input);
	}
	syncState(state) {
		this.input.value = state.color;
	}
}

//Lists functions to be called by each tool to fill the pixels on the canvas - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

//Tool for individual pixel edits
function draw(pos, state, dispatch) {
	function drawPixel({ x, y }, state) {
		let drawn = { x, y, color: state.color };
		dispatch({ picture: state.picture.draw([drawn]) });
	}
	drawPixel(pos, state);
	return drawPixel;
}

//Function tool for drawing rectangles
function rectangle(start, state, dispatch) {
	function drawRectangle(pos) {
		let xStart = Math.min(start.x, pos.x);
		let yStart = Math.min(start.y, pos.y);
		let xEnd = Math.max(start.x, pos.x);
		let yEnd = Math.max(start.y, pos.y);
		let drawn = [];

		for (let y = yStart; y <= yEnd; y++) {
			for (let x = xStart; x <= xEnd; x++) {
				drawn.push({ x, y, color: state.color });
			}
		}

		dispatch({ picture: state.picture.draw(drawn) });
	}
	drawRectangle(start);
	return drawRectangle;
}

//Pathfinding algorythym used to find and fill empty pixels on the editor
const around = [
	{ dx: -1, dy: 0 },
	{ dx: 1, dy: 0 },
	{ dx: 0, dy: -1 },
	{ dx: 0, dy: 1 },
];

function fill({ x, y }, state, dispatch) {
	let targetColor = state.picture.pixel(x, y);
	let drawn = [{ x, y, color: state.color }];

	for (let done = 0; done < drawn.length; done++) {
		for (let { dx, dy } of around) {
			let x = drawn[done].x + dx;
			let y = drawn[done].y + dy;

			if (
				x >= 0 &&
				x < state.picture.width &&
				y >= 0 &&
				y < state.picture.height &&
				state.picture.pixel(x, y) == targetColor &&
				!drawn.some((p) => p.x == x && p.y == y)
			) {
				drawn.push({ x, y, color: state.color });
			}
		}
	}
	dispatch({ picture: state.picture.draw(drawn) });
}
//Color Picker
function pick(pos, state, dispatch) {
	dispatch({ color: state.picture.pixel(pos.x, pos.y) });
}

// Sets up saving, loading, and undo - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Save button
class SaveButton {
	constructor(state) {
		this.picture = state.picture;
		this.dom = changePX(
			'button',
			{
				onclick: () => this.save(),
			},
			'Save'
		);
	}
	save() {
		let canvas = changePX('canvas');
		drawPicture(this.picture, canvas, 1);
		let link = changePX('a', {
			href: canvas.toDataURL(),
			download: 'pixel8art.png',
		});
		document.body.appendChild(link);
		link.click();
		link.remove();
	}
	syncState(state) {
		this.picture = state.picture;
	}
}

//Load button and function to load
class LoadButton {
	constructor(_, { dispatch }) {
		this.dom = changePX(
			'button',
			{ onclick: () => startLoad(dispatch) },
			'Load'
		);
	}
	syncState() {}
}
function startLoad(dispatch) {
	let input = changePX('input', {
		type: 'file',
		onchange: () => finishLoad(input.files[0], dispatch),
	});
	document.body.appendChild(input);
	input.click();
	input.remove();
}
function finishLoad(file, dispatch) {
	if (file == null) {
		return;
	}
	let reader = new FileReader();
	reader.addEventListener('load', () => {
		let image = changePX('img', {
			onload: () => dispatch({ picture: pictureFromImage(image) }),
			src: reader.result,
		});
	});
	reader.readAsDataURL(file);
}
function pictureFromImage(image) {
	let width = Math.min(100, image.width);
	let height = Math.min(100, image.height);
	let canvas = changePX('canvas', { width, height });
	let cx = canvas.getContext('2d');
	cx.drawImage(image, 0, 0);
	let pixels = [];
	let { data } = cx.getImageData(0, 0, width, height);

	function hex(n) {
		return n.toString(16).padStart(2, '0');
	}

	for (let i = 0; i < data.length; i += 4) {
		let [r, g, b] = data.slice(i, i + 3);
		pixels.push('#' + hex(r) + hex(g) + hex(b));
	}
	return new Picture(width, height, pixels);
}

// Undo function - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
function historyUpdateState(state, action) {
	if (action.undo == true) {
		if (state.done.length == 0) {
			return state;
		}
		return Object.assign({}, state, {
			picture: state.done[0],
			done: state.done.slice(1),
			doneAt: 0,
		});
	} else if (action.picture && state.doneAt < Date.now() - 1000) {
		return Object.assign({}, state, action, {
			done: [state.picture, ...state.done],
			doneAt: Date.now(),
		});
	} else {
		return Object.assign({}, state, action);
	}
}

class UndoButton {
	constructor(state, { dispatch }) {
		this.dom = changePX(
			'button',
			{
				onclick: () => dispatch({ undo: true }),
				disabled: state.done.length == 0,
			},
			'Undo'
		);
	}
	syncState(state) {
		this.dom.disabled = state.done.length == 0;
	}
}

// Set up of initial state for the App!!! - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
//Initial canvas of white pixels
const startState = {
	tool: 'draw',
	color: '#000000',
	picture: Picture.empty(100, 50, '#ffffff'),
	done: [],
	doneAt: 0,
};
//Tools available that are defined above
const baseTools = { draw, fill, rectangle, pick };
//Control bar from classes above
const baseControls = [
	ToolSelect,
	ColorSelect,
	SaveButton,
	LoadButton,
	UndoButton,
];
//Starting function
function startPixelEditor({
	state = startState,
	tools = baseTools,
	controls = baseControls,
}) {
	let app = new PixelEditor(state, {
		tools,
		controls,
		dispatch(action) {
			state = historyUpdateState(state, action);
			app.syncState(state);
		},
	});
	return app.dom;
}
