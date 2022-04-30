# Pixel-8
Check it out in action [right here!](https://pixel-8.netlify.app/ "Pixel-8: A Pixel Editor")

<a href="https://ibb.co/NKXd8HH"><img src="https://i.ibb.co/WfQ4bYY/Screen-Shot-2022-04-30-at-8-50-57-AM.png" alt="Screen-Shot-2022-04-30-at-8-50-57-AM" border="0"></a>

## How it Works
The app is based on a HTML canvas element that is divided into individual "pixels" which can be controlled independently. This canvas, along with the tools and controls, form the app which we can insert into the DOM once it is initialized.

The data in the canvas is stored in the following object as an array, which can be read and updated as the user interacts with it.
```javascript
class Picture {
	//Creates props for size of editor
	constructor(width, height, pixels) {
		this.width = width;
		this.height = height;
		//Pixels is stored as an array
		this.pixels = pixels;
	}
```
Later on, when we start to assemble this app to be sent to the DOM, this array is updated to change colors of each pixel for the user.

---

### The Canvas Itself
```javascript
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
```
This class sets up the canvas on which we can draw, the largest part of the app. There is a global state that is initialized for the app to start which is updated across every object. The ```changePX()``` function adds elements to the DOM with whatever arguments are passed in. In this case, it creates a canvas with pixels each having the ```onmousedown``` event handler.

There are two methods included in the canvas to handle both mouse events and touch events. Without the touch events, mobile users would instead scroll on the app. 
```javascript
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
```
This method, part of the PictureCanvas class, takes a click event and sends data to the canvas itself from each pixel. Once the data is given to the PictureCanvas, the state is updated accordingly to change the colors of the pixel array.

---

### The Tools
Part of the state that is monitored is the tool that the user selects. There is a draw, rectangle, fill, and color picker tool.

#### Draw
The draw tool function is used when the user's state has it selected (which is also the default). It looks for a single pixel location and then updates that pixel with the color what was selected using ```dispatch({ picture: state.picture.draw([drawn]) })```.
```javascript
function draw(pos, state, dispatch) {
	function drawPixel({ x, y }, state) {
		let drawn = { x, y, color: state.color };
		dispatch({ picture: state.picture.draw([drawn]) });
	}
	drawPixel(pos, state);
	return drawPixel;
}
```

#### Rectangle
The rectangle tool works much in the same way as draw, but instead calculates the beginning and end pixels in a square. It uses ```drawn.push()``` to add these to an array, but it does not actually commit these changes until the user lets go of the click. That way, if the rectangle is resized, it does not start adding pixels as the user adjusts the shape. Nifty!
```javascript
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
```

#### Fill
The most complicated tool is the fill. Essentially, is uses the ```const around = []``` array to determine if there are nearby pixels below, above, left, or right of the selected pixel that need to be filled. If there are, they are added to the array of pixels to be updated and themselves are checked using the same function. This runs until the function hits the limits of the canvas or untill all possible routes have been explored. 
```javascript
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
```

#### Color Picker
The color picker gets and updates the color based on which pixel was selected.
```javascript
function pick(pos, state, dispatch) {
	dispatch({ color: state.picture.pixel(pos.x, pos.y) });
}
```

---

### Saving, Loading, and Undo

#### Saving
The saving feature is housed inside of the ```SaveButton``` class, but uses the following script:
```javascript
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
```
This method grabs the canvas and converts it to a link where the canvas is converted to a .png image. It then adds the download link and simulates a user click while removing the link afterward.

#### Loading
Loading parses and image into either a given pixel size or a 100x100 canvas. It looks at the color that would be in each square of the image and populates the pixel array accordingly. Users can upload any image they choose, but larger files, like a HD photo, will likely only show a tiny fraction of the photo itelf as it hits the size limit.
```javascript
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
```

#### Undo
The undo function works similarly to how React can save past states. At 1000ms intervals, it captures and saves a snapshot of the array to be called back later. The changes are not "undone" but instead overwritten:
```javascript
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
```

---

## Contact Me
Feel free to fork this idea or add it to your own applications. There are tons of libraries for art in JS like Paper.js and P5.js, but this was a fun experiment using the vanilla JS we all know and love. 

Bryce Stabenow - [@BryceStabenow](https://twitter.com/BryceStabenow) - brycestabenow617@gmail.com
