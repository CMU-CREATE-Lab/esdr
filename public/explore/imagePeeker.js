
class ImagePeeker {
	constructor(url) {
		let img = new Image()
		this.image = img

		this.image.onload = () => {
			var canvas = document.createElement('canvas');
			canvas.width = img.width;
			canvas.height = img.height;
			let ctx = canvas.getContext('2d')
			ctx.drawImage(img, 0, 0, img.width, img.height);

			this.canvas = canvas
			this.ctx = ctx
		}

		this.image.src = url
	}

	colorMapLookup(value, range) {
		if (!this.canvas || !isFinite(value))
			return undefined

		let u = Math.min(Math.max((value - range.min)/(range.max - range.min), 0.0), 1.0)
		let x = u*this.canvas.width
		let px = this.ctx.getImageData(x, 0, 1, 1).data

		return [px[0]/255.0, px[1]/255.0, px[2]/255.0, px[3]/255.0]
	}
} // class ImagePeeker

export {ImagePeeker}