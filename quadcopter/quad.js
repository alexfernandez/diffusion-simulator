'use strict'

// time
const dt = 0.1
let time = 0

// drone characterization
let size = 75
let pitch = 0
let yaw = 0
let roll = 0

// drone movement
let pos = [0, 0, 0]
let speed = [0, 0, 0]
let accel = [0, 0, 0]
let gravity = [0, 0, -1]

// parameters
const fontSize = 16
const camera = [0, 0, 4]
let ctx, updater, raw
let width, height

window.onload = () => {
	resetSimulation()
	draw()
	if (getCheckbox('autorun')) {
		console.log('running')
		run()
	}
	document.getElementById('run').onclick = run
	document.getElementById('pause').onclick = pause
	document.getElementById('reset').onclick = reset
}

function run() {
	if (updater) return
	updater = window.setInterval(() => {
		update()
		draw()
	}, dt * 1000)
}

function pause() {
	if (!updater) return
	window.clearInterval(updater)
	updater = null
}

function reset() {
	pause()
	resetSimulation()
	draw()
}

function resetSimulation() {
	console.log('resetting')
	time = 0
	const canvas = document.getElementById('canvas');
	width = canvas.width
	height = canvas.height - fontSize
	ctx = canvas.getContext('2d');
	ctx.font = '16px sans-serif'
	ctx.clearRect(0, 0, width, height)
	//raw = ctx.getImageData(0, 0, width, height);
	pos = [0, 0, 0]
	speed = [0, 0, 0]
	accel = [0, 0, 0]
	//const nparticles = getParameter('particles')
	//speed = getParameter('speed')
	console.log('reset')
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

function update() {
	time += dt
	const newAccel = sum(accel, gravity)
	console.log('speed', speed)
	const newSpeed = sum(scale(newAccel, dt), speed)
	const newPos = sum(scale(newSpeed, dt), pos)
	console.log('accel', newAccel, scale(newAccel, dt), 'speed', newSpeed, newPos)
	speed = newSpeed
	pos = newPos
	draw()
}

function draw() {
	ctx.clearRect(0, height, width, height + fontSize)
	//ctx.putImageData(raw, 0, 0);
	drawDrone()
	ctx.fillText('t = ' + time.toFixed(1) + ' s', 100, height + fontSize - 1)
	//ctx.fillText('count = ' + count(255).toFixed(0), 300, height + fontSize - 1)
	//ctx.fillText('visited = ' + count(50).toFixed(0), 500, height + fontSize - 1)
}

function drawDrone() {
	const coords = computeDroneCoords()
	line3d(coords[0], coords[2])
	line3d(coords[1], coords[3])
}

function computeDroneCoords() {
	const dist = size / 2
	const coord1 = sum(pos, [-dist, -dist, 0])
	const coord2 = sum(pos, [dist, -dist, 0])
	const coord3 = sum(pos, [dist, dist, 0])
	const coord4 = sum(pos, [-dist, dist, 0])
	return [coord1, coord2, coord3, coord4]
}

function sum(vector1, vector2) {
	console.log(`Adding ${vector1} and ${vector2}`)
	if (vector1[0] === undefined) {
		throw Error(`Bad vector1 for sum: ${vector1}`)
	}
	if (vector2[0] === undefined) {
		throw Error(`Bad vector2 for sum: ${vector2}`)
	}
	return [vector1[0] + vector2[0], vector1[1] + vector2[1], vector1[2] + vector2[2]]
}

function scale(vector, factor) {
	return [factor * vector[0], factor * vector[1], factor * vector[2]]
}

function line3d(pos1, pos2) {
	const point1 = convert3d(pos1)
	const point2 = convert3d(pos2)
	line2d(point1, point2)

}

function convert3d(pos) {
	const x = (pos[0] + camera[0]) / (pos[2] + camera[2])
	const y = (pos[1] + camera[1]) / (pos[2] + camera[2])
	return {x, y}
}

function line2d(point1, point2) {
	console.log(point1, point2)
	ctx.beginPath()
	ctx.moveTo(width / 2 + point1.x, height / 2 + point1.y)
	ctx.lineTo(width / 2 + point2.x, height / 2 + point2.y)
	//ctx.moveTo(30, 50)
	//ctx.lineTo(150, 100)
	ctx.stroke()
}

function count(value) {
	let count = 0
	const p = new Particle()
	for (let i = 0; i < raw.data.length; i++) {
		if (raw.data[i + 3] === value) {
			count += 1
		}
	}
	return count
}

class Particle {
	x = Math.round(width / 2)
	y = Math.round(height / 2)

	move() {
		this.launch()
		if (this.x >= width) {
			this.x = width - 1
		}
		if (this.x < 0) {
			this.x = 0
		}
		if (this.y >= height) {
			this.y = height - 1
		}
		if (this.y < 0) {
			this.y = 0
		}

	}

	drift() {
		const r = Math.random()
		if (r >= 0.5) {
			if (r >= 0.75) {
				this.x += 1
			} else {
				this.x -= 1
			}
		} else {
			if (r >= 0.25) {
				this.y += 1
			} else {
				this.y -= 1
			}
		}
	}

	launch() {
		const r = Math.random() * speed
		const angle = 2 * Math.random() * Math.PI
		const dx = r * Math.cos(angle)
		const dy = r * Math.sin(angle)
		this.x += Math.round(dx)
		this.y += Math.round(dy)
	}

	diffuse() {
		const ox = this.x
		const oy = this.y
		this.move()
		if (this.find()) {
			this.x = ox
			this.y = oy
		}
	}

	getIndex() {
		return (this.x + this.y * width) * 4
	}

	find() {
		return raw.data[this.getIndex() + 3] === 255
	}

	erase() {
		const index = this.getIndex()
		raw.data[index] = 0
		raw.data[index + 1] = 0
		raw.data[index + 2] = 0
		raw.data[index + 3] = erased
	}

	draw() {
		const index = this.getIndex()
		raw.data[index] = 0
		raw.data[index + 1] = 0
		raw.data[index + 2] = 0
		raw.data[index + 3] = 255
	}
}

