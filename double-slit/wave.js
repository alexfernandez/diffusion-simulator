'use strict'

let time = 0, speedms = 0, damping = 0, sizem = 50
let width, height, cx, cy, propagation
const period = 10
const dt = 0.05
const fontSize = 16
let ctx, updater, raw
let grid0 = []
let grid1 = []
let grid2 = []

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
	if (propagation > 0.5) {
		alert(`Propagation ${propagation} too big > 0.5, aborting`)
		return
	}
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
	cx = Math.round(width / 2)
	cy = Math.round(height / 2)
	ctx = canvas.getContext('2d');
	ctx.font = '16px sans-serif'
	ctx.clearRect(0, 0, width, height)
	raw = ctx.getImageData(0, 0, width, height);
	speedms = getParameter('speed')
	damping = getParameter('damping')
	propagation = computePropagation()
	grid0 = createGrid()
	initGrid(grid0)
	grid1 = createGrid()
	initGrid(grid1)
	grid2 = createGrid()
	console.log('propagation ', propagation)
	console.log('reset')
}

function computePropagation() {
	const dx = sizem / width
	const interval = dt * speedms / dx
	return interval * interval
}

function createGrid() {
	const grid = []
	for (let i = -1; i <= width; i++) {
		grid[i] = []
		for (let j = -1; j <= height; j++) {
			grid[i][j] = 0
		}
	}
	return grid
}

function initGrid(grid) {
	grid[cx][cy] = 0
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function getCheckbox(name) {
	return document.getElementById(name).checked
}

function update() {
	time += dt
	advance()
	draw()
	replace()
}

function advance() {
	for (let i = 0; i < width; i++) {
		for (let j = 0; j < height; j++) {
			grid2[i][j] = computeNext(i, j)
		}
	}
	wrapup()
	if (time < period) {
		grid2[cx][cy] = Math.sin(2 * Math.PI * time / period)
	}
}

function computeNext(i, j) {
	const localDamping = damping //computeDamping(i, j)
	const previous = grid1[i][j]
	const damped = (1 - localDamping * dt) * (previous - grid0[i][j])
	const neighbors = grid1[i + 1][j] + grid1[i - 1][j] + grid1[i][j + 1] + grid1[i][j - 1]
	const influence = propagation * (neighbors - 4 * previous)
	return previous + damped + influence
}

function computeDamping(i, j) {
	const lowratio = 0.25
	const highratio = 0.30
	const distancex = Math.abs(cx - i) / width
	const distancey = Math.abs(cy - j) / height
	if (distancex > highratio || distancey > highratio) {
		return 1
	}
	if (distancex < lowratio && distancey < lowratio) {
		return damping
	}
	const distance = Math.max(distancex, distancey)
	return (distance - lowratio) / (highratio - lowratio)
}

function wrapup() {
	wrapupZero()
}

function wrapupZero() {
	for (let i = -1; i <= width; i++) {
		grid2[i][-1] = 0
		grid2[i][height] = 0
	}
	for (let j = -1; j <= height; j++) {
		grid2[-1][j] = 0
		grid2[width][j] = 0
		grid2[width - 1][j]
	}
}

function wrapupEqual() {
	for (let i = 0; i <= width - 1; i++) {
		grid2[i][-1] = grid2[i][0]
		grid2[i][height] = grid2[i][height - 1]
	}
	for (let j = 0; j <= height - 1; j++) {
		grid2[-1][j] = grid2[0][j]
		grid2[width][j] = grid2[width - 1][j]
	}
	grid2[-1][-1] = grid2[0][0]
	grid2[-1][height] = grid2[0][height - 1]
	grid2[width][-1] = grid2[width - 1][0]
	grid2[width][height] = grid2[width - 1][height - 1]
}

function wrapupSecond() {
	for (let i = 0; i <= width - 1; i++) {
		grid2[i][-1] = 2 * grid2[i][0] - grid2[i][1]
		grid2[i][height] = 2 * grid2[i][height - 1] - grid2[i][height - 2]
	}
	for (let j = 0; j <= height - 1; j++) {
		grid2[-1][j] = 2 * grid2[0][j] - grid2[1][j]
		grid2[width][j] = 2 * grid2[width - 1][j] - grid2[width - 2][j]
	}
}

function draw() {
	ctx.clearRect(0, height, width, height + fontSize)
	for (let i = 0; i < width; i++) {
		for (let j = 0; j < height; j++) {
			setPixel(i, j, grid2[i][j])
		}
	}
	ctx.putImageData(raw, 0, 0);
	ctx.fillText('t = ' + time.toFixed(1) + ' s', 100, height + fontSize - 1)
	//console.log(grid2[cx + 1][cy])
}

function replace() {
	const recycled = grid0
	grid0 = grid1
	grid1 = grid2
	grid2 = recycled
}

function setPixel(x, y, value) {
	const index = (x + y * width) * 4
	if (value > 1 || value < -1) {
		raw.data[index] = 0
		raw.data[index + 1] = 0
		raw.data[index + 2] = 0
	}
	else if (value >= 0) {
		raw.data[index] = 255
		raw.data[index + 1] = (1 - value) * 255
		raw.data[index + 2] = (1 - value) * 255
	} else {
		raw.data[index] = (1 + value) * 255
		raw.data[index + 1] = 255
		raw.data[index + 2] = (1 + value) * 255
	}
	raw.data[index + 3] = 255
}

