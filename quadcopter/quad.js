'use strict'

// time
const dt = 0.1
let time = 0

// drone characterization
let size = 0.075
let pitch = 0
let yaw = 0
let roll = 0

// drone movement
let pos = [0, 0, 0]
let speed = [0, 0, 0]
let accel = [0, 0, 0]
let gravity = [0, 0, -9.8]
let propulsion

// drag
const cd = 0.4
const density = 1.2
const area = size * size

// parameters
const fontSize = 16
const cameraPos = [0, -1, 1]
const cameraScale = 200
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
		if (propulsion.isFinished()) {
			pause()
		}
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
	//const nparticles = getParameter('particles')
	//speed = getParameter('speed')
	propulsion = new Propulsion()
	console.log('reset')
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

function update() {
	updatePhysics()
	draw()
}

function updatePhysics() {
	const newTime = time + dt
	accel = computeAccel()
	console.log(`speed: ${speed}`)
	const newSpeed = sum(scale(accel, dt), speed)
	const newPos = sum(scale(newSpeed, dt), pos)
	if (newPos[2] < 0) {
		newPos[2] = 0
		newSpeed[2] = 0
	}
	time = newTime
	speed = newSpeed
	pos = newPos
}

function computeAccel() {
	const accel = [0, 0, propulsion.computeAccel(dt)]
	const accelGrav = sum(accel, gravity)
	const drag = computeDrag()
	console.log(`drag: ${drag}`)
	const total = sum(accelGrav, drag)
	return total
}

function computeDrag() {
	const factor = 0.5 * density * cd * area
	return scale(speed, factor)
}

function draw() {
	ctx.clearRect(0, height, width, height + fontSize)
	ctx.clearRect(0, 0, width, height)
	//ctx.putImageData(raw, 0, 0);
	drawDrone()
	ctx.fillText(`t = ${time.toFixed(1)} s`, 100, height + fontSize - 1)
	ctx.fillText(`pos = ${display(pos)}`, 300, height + fontSize - 1)
	ctx.fillText(`acc = ${display(accel)}`, 500, height + fontSize - 1)
}

function drawDrone() {
	const coords = computeDroneCoords()
	line3d(coords[0], coords[2], 'blue')
	line3d(coords[1], coords[3], 'blue')
	line3d(pos, sum(pos, accel), 'red')
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

function display(vector) {
	return `[${vector[0].toFixed(1)}, ${vector[1].toFixed(1)}, ${vector[2].toFixed(1)}]`
}

function line3d(pos1, pos2, color) {
	const point1 = convert3d(pos1)
	const point2 = convert3d(pos2)
	line2d(point1, point2, color)

}

function convert3d(pos) {
	const x = cameraScale * (pos[0] - cameraPos[0]) / (pos[1] - cameraPos[1])
	const y = - cameraScale * (pos[2] - cameraPos[2]) / (pos[1] - cameraPos[1])
	return {x, y}
}

function line2d(point1, point2, color) {
	ctx.strokeStyle = color
	ctx.beginPath()
	ctx.moveTo(width / 2 + point1.x, height / 2 + point1.y)
	ctx.lineTo(width / 2 + point2.x, height / 2 + point2.y)
	//ctx.moveTo(30, 50)
	//ctx.lineTo(150, 100)
	ctx.stroke()
}

class Propulsion {
	intervals = [[5, 9.9], [2, 9], [5, 9.9], [1, 0]]
	currentInterval = 0
	pending = 0
	constructor() {
		this.computePending()
	}

	getInterval() {
		return this.intervals[this.currentInterval]
	}

	computePending() {
		const interval = this.getInterval()
		this.pending = interval[0] || 0
	}

	computeAccel(dt) {
		this.pending -= dt
		if (this.pending < 0) {
			this.currentInterval += 1
			if (this.isFinished()) {
				return 0
			}
			this.computePending()
		}
		const interval = this.getInterval()
		return interval[1]
	}

	isFinished() {
		return this.currentInterval >= this.intervals.length
	}
}

