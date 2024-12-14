'use strict'

// time
const dt = 0.1
let time = 0
const timeScale = 1/dt

// drone characterization
let drone
const heightTarget = 1
let yawTarget, pitchTarget, rollTarget, windActive, motorImprecisionPercent

// screen
let updater, screen, graph

window.onload = () => {
	screen = new Screen()
	graph = new Graph()
	resetSimulation()
	screen.draw()
	graph.clear()
	if (getCheckbox('autorun')) {
		console.log('running')
		run()
	}
	document.getElementById('run').onclick = run
	document.getElementById('pause').onclick = pause
	document.getElementById('reset').onclick = reset
}

function run() {
	readParameters()
	if (updater) return
	updater = window.setInterval(() => {
		update(dt)
		screen.draw()
		if (drone.isFinished(time)) {
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
	screen.draw()
	graph.clear()
}

function resetSimulation() {
	readParameters()
	time = 0
	drone = new Drone(heightTarget, yawTarget, pitchTarget, rollTarget)
	console.log('reset')
}

function readParameters() {
	yawTarget = getDegrees('yaw')
	pitchTarget = getDegrees('pitch')
	rollTarget = getDegrees('roll')
	motorImprecisionPercent = getParameter('motor-imprecision')
	windActive = getCheckbox('wind')
}

function getDegrees(name) {
	return getParameter(name) * Math.PI / 180
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

function update(dt) {
	const newTime = time + dt
	drone.update(dt)
	time = newTime
}

class Canvas {
	width = 0
	height = 0
	ctx = null
	fontSize = 14

	constructor(id) {
		const canvas = document.getElementById(id);
		this.width = canvas.width
		this.height = canvas.height
		this.ctx = canvas.getContext('2d');
		this.ctx.font = `${this.fontSize}px sans-serif`
		this.ctx.clearRect(0, 0, this.width, this.height)
	}

	plot2d([x, y], color) {
		return this.line2d([x, y], [x+1, y+1], color)
	}

	line2d([x1, y1], [x2, y2], color) {
		this.ctx.strokeStyle = color
		this.ctx.beginPath()
		this.ctx.moveTo(x1, y1)
		this.ctx.lineTo(x2, y2)
		this.ctx.stroke()
	}

	displayDegrees(angle) {
		const degrees = angle * 180 / Math.PI
		return degrees.toFixed(1) % 360
	}
}

class Screen extends Canvas {
	cameraPos = [0, -1, 1]
	cameraScale = 200

	constructor() {
		super('canvas')
		this.height -= this.fontSize
	}

	draw() {
		this.ctx.clearRect(0, this.height, this.width, this.height + this.fontSize)
		this.ctx.clearRect(0, 0, this.width, this.height)
		drone.draw()
		this.drawHorizon()
		const texts = [
			`t: ${time.toFixed(1)} s`,
			`pos: ${this.displayVector(drone.pos.getDistances())}`,
			`vel: ${this.displayVector(drone.pos.getSpeed())}`,
			`acc: ${this.displayVector(drone.pos.getAccel())}`,
		]
		this.ctx.fillText(texts.join(', '), 1, this.height + this.fontSize - 1)
	}

	drawHorizon() {
		const y = 1000
		const max = 10000
		this.line3d([-max, y, 0], [max, y, 0], 'orange')
	}

	line3d(pos1, pos2, color) {
		if (pos1[1] < this.cameraPos[1] || pos2[1] < this.cameraPos[1]) {
			// behind the camera
			return
		}
		const point1 = this.convert3d(pos1)
		const point2 = this.convert3d(pos2)
		this.centeredLine2d(point1, point2, color)
	}

	centeredLine2d([x1, y1], [x2, y2], color) {
		return this.line2d([x1 + this.width / 2, y1 + this.height / 2], [x2 + this.width / 2, y2 + this.height / 2], color)
	}

	convert3d([vx, vy, vz]) {
		const x = this.cameraScale * (vx - this.cameraPos[0]) / (vy - this.cameraPos[1])
		const y = - this.cameraScale * (vz - this.cameraPos[2]) / (vy - this.cameraPos[1])
		return [x, y]
	}

	displayVector([x, y, z]) {
		return `[${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}]`
	}
}

class Graph extends Canvas {
	// [name, color, scale]
	specs = [['height', 'black', 30], ['yaw', 'red', 10], ['pitch', 'green', 10], ['roll', 'blue', 10]]
	subgraphs = []

	constructor() {
		super('graph')
		this.buildSubgraphs()
	}

	buildSubgraphs() {
		const total = this.specs.length
		const height = this.height / total
		let start = 0
		const axis = this.height / (2 * total)
		for (const spec of this.specs) {
			const subgraph = new Subgraph(start, axis, spec)
			this.subgraphs.push(subgraph)
			start += height
		}
	}

	clear() {
		this.ctx.clearRect(0, 0, this.width, this.height)
		for (const subgraph of this.subgraphs) {
			subgraph.clear()
		}
	}

	draw(values) {
		console.log('draw', values)
		const x = timeScale * time
		for (let index = 0; index < values.length; index++) {
			const value = values[index]
			const subgraph = this.subgraphs[index]
			subgraph.draw(x, value)
		}
	}
}

class Subgraph {
	constructor(start, axis, spec) {
		this.start = start
		this.axis = axis
		this.name = spec[0]
		this.color = spec[1]
		this.scale = spec[2]
	}

	clear() {
		console.log(this.start, this.axis)
		graph.line2d([0, this.start], [graph.width, this.start], 'grey')
		graph.line2d([0, this.start + this.axis], [graph.width, this.start + this.axis], this.color)
	}

	draw(x, y) {
		console.log('graph', x, y)
		graph.plot2d([x, this.start + this.axis - y * this.scale - 1], this.color)
		graph.ctx.clearRect(0, this.start, graph.width, graph.fontSize)
		graph.ctx.fillText(`${this.name}: ${y.toFixed(1)}`, 5, this.start + graph.fontSize - 1)
	}
}

