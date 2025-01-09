'use strict'

const timeScale = 10

// screen
let screen

window.onload = () => {
	screen = new Screen()
	screen.clear()
	document.getElementById('run').onclick = resetSimulation
	document.getElementById('p1value').oninput = resetSimulation
	document.getElementById('i1value').oninput = resetSimulation
	document.getElementById('d1value').oninput = resetSimulation
	document.getElementById('p2value').oninput = resetSimulation
	document.getElementById('i2value').oninput = resetSimulation
	document.getElementById('d2value').oninput = resetSimulation
	document.getElementById('delay').oninput = resetSimulation
	console.log('running')
	resetSimulation()
}

function resetSimulation() {
	console.log('resetting')
	screen.clear()
	const drone = new Drone()
	console.log('reset')
	drone.algorithm = getRadioButton('algorithm')
	const p1value = getParameter('p1value')
	const i1value = getParameter('i1value')
	const d1value = getParameter('d1value')
	drone.speedComputer.weights = [p1value, i1value, d1value]
	const p2value = getParameter('p2value')
	const i2value = getParameter('i2value')
	const d2value = getParameter('d2value')
	drone.accelComputer.weights = [p2value, i2value, d2value]
	drone.delay = getParameter('delay')
	console.log(`pids weights: ${drone.speedComputer.weights}, ${drone.accelComputer.weights}, delay: ${drone.delay}`)
	run(drone, screen)
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getRadioButton(name) {
	return document.querySelector(`input[name="${name}"]:checked`).value
}

class Screen {
	canvas = null
	width = 0
	height = 0
	ctx = null
	updater = null
	fontSize = 16
	first = 0
	second = 0
	third = 0

	constructor() {
		this.canvas = document.getElementById('canvas')
		this.width = this.canvas.width
		this.height = this.canvas.height
		this.first = this.height / 3
		this.second = 2 * this.height / 3
		this.third = this.height
		this.axis = this.height / 6
		this.ctx = this.canvas.getContext('2d');
		this.ctx.font = '16px sans-serif'
		this.ctx.clearRect(0, 0, this.width, this.height)
		this.canvas.addEventListener('mousemove', e => this.showCoords(e))
		this.maxTime = this.width / timeScale
	}

	clear() {
		this.ctx.clearRect(0, 0, this.width, this.height)
		this.line2d([0, this.axis], [this.width, this.axis], 'red')
		this.line2d([0, this.first], [this.width, this.first], 'black')
		this.line2d([0, this.first + this.axis], [this.width, this.first + this.axis], 'green')
		this.line2d([0, this.second], [this.width, this.second], 'black')
		this.line2d([0, this.second + this.axis], [this.width, this.second + this.axis], 'blue')
	}

	draw(drone, time) {
		this.ctx.clearRect(0, 0, this.width, this.fontSize)
		this.ctx.fillText(`accel = ${drone.accel.toFixed(1)}`, 50, this.fontSize - 1)
		this.ctx.clearRect(0, this.first, this.width, this.fontSize)
		this.ctx.fillText(`speed = ${drone.speed.toFixed(1)}`, 50, this.first + this.fontSize - 1)
		this.ctx.clearRect(0, this.second, this.width, this.fontSize)
		this.ctx.fillText(`pos = ${drone.pos.toFixed(1)}`, 50, this.second + this.fontSize - 1)
		const x = timeScale * time
		this.plot2d([x, this.axis - drone.accel - 1], 'red')
		this.plot2d([x, this.first + this.axis - drone.speed - 1], 'green')
		this.plot2d([x, this.second + this.axis - drone.pos - 1], 'blue')
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

	showCoords(e) {
		this.canvas.title = `${e.offsetX / timeScale} s`
	}
}

