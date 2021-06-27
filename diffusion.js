'use strict'

let time = 0, speed, erased
let width, height
const dt = 0.1
const fontSize = 16
let ctx, updater, raw
let particles = []

window.onload = () => {
	resetSimulation()
	run()
	document.getElementById('run').onclick = run
	document.getElementById('pause').onclick = pause
	document.getElementById('stop').onclick = stop
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

function stop() {
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
	raw = ctx.getImageData(0, 0, width, height);
	const nparticles = getParameter('particles')
	speed = getParameter('speed')
	erased = document.getElementById('visited').checked ? 50 : 0
	particles = []
	for (let i = 0; i < nparticles; i++) {
		const particle = new Particle()
		particles[i] = particle
		while (particle.find()) {
			particle.move()
		}
		particle.draw()
	}
	console.log('reset')
}

function getParameter(name) {
	return parseFloat(document.getElementById(name).value)
}

function update() {
	time += dt
	for (const particle of particles) {
		particle.erase()
		particle.diffuse()
		particle.draw()
	}
	draw()
}

function draw() {
	ctx.clearRect(0, height, width, height + fontSize)
	ctx.putImageData(raw, 0, 0);
	ctx.fillText('t = ' + time.toFixed(1) + ' s', 100, height + fontSize - 1)
	ctx.fillText('count = ' + count(255).toFixed(0), 300, height + fontSize - 1)
	ctx.fillText('visited = ' + count(50).toFixed(0), 500, height + fontSize - 1)
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

