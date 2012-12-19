// compile with gcc pngsetdpi.c -std=c99 -lpng -o pngsetdpi

#include <stdint.h>
#include <stdlib.h>
#include <png.h>

int main(int argc, char **argv)
{
	FILE *fp;
	int bit_depth, color_type, interlace_type;
	png_structp png_ptr;
	png_infop info_ptr;
	png_uint_32 width, height;

	if (argc < 3) {
		fprintf(stderr, "Usage: pngsetdpi <file> <dpi>\n");
		return -1;
	}

	if ((fp = fopen(argv[1], "rb")) == NULL) {
		fprintf(stderr, "Error opening %s\n", argv[1]);
		return -2;
	}

	png_ptr = png_create_read_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);
	if (png_ptr == NULL) {
		fclose(fp);
		return -3;
	}

	info_ptr = png_create_info_struct(png_ptr);
	if (info_ptr == NULL) {
		fclose(fp);
		return -4;
	}

	if (setjmp(png_jmpbuf(png_ptr))) {
		png_destroy_read_struct(&png_ptr, &info_ptr, (png_infopp)NULL);
		fclose(fp);
		return -5;
	}

	png_init_io(png_ptr, fp);
	png_read_info(png_ptr, info_ptr);
	png_get_IHDR(png_ptr, info_ptr, &width, &height, &bit_depth, &color_type, &interlace_type, NULL, NULL);

	png_bytep row_pointers[height];
	for (int row=0; row < height; row++) {
		row_pointers[row] = malloc(png_get_rowbytes(png_ptr, info_ptr));
	}
	png_read_image(png_ptr, row_pointers);
	png_read_end(png_ptr, info_ptr);

	png_destroy_read_struct(&png_ptr, &info_ptr, (png_infopp)NULL);
	fclose(fp);

	if (color_type == PNG_COLOR_TYPE_PALETTE) {
		fprintf(stderr, "Palette-type images are not supported\n");
		return -6;
	}

	uint32_t dpi = atoi(argv[2]);
	if (dpi == 0) {
		fprintf(stderr, "Invalid DPI value\n");
		return -7;
	}

	if ((fp = fopen(argv[1], "wb")) == NULL) {
		fprintf(stderr, "Error opening %s for writing\n", argv[1]);
		return -8;
	}

	png_ptr = png_create_write_struct(PNG_LIBPNG_VER_STRING, NULL, NULL, NULL);
	if (png_ptr == NULL) {
		fclose(fp);
		return -9;
	}

	info_ptr = png_create_info_struct(png_ptr);
	if (info_ptr == NULL) {
		fclose(fp);
		return -10;
	}

	if (setjmp(png_jmpbuf(png_ptr))) {
		// error handling
		png_destroy_write_struct(&png_ptr, &info_ptr);
		fclose(fp);
		return -11;
	}

	png_init_io(png_ptr, fp);
	png_set_IHDR(png_ptr, info_ptr, width, height, bit_depth, color_type, PNG_INTERLACE_NONE, PNG_COMPRESSION_TYPE_BASE, PNG_FILTER_TYPE_BASE);
	png_set_pHYs(png_ptr, info_ptr, dpi/0.0254, dpi/0.0254, PNG_RESOLUTION_METER);
	png_write_info(png_ptr, info_ptr);

	png_write_image(png_ptr, row_pointers);
	png_write_end(png_ptr, info_ptr);

	png_destroy_write_struct(&png_ptr, &info_ptr);
	fclose(fp);
	for (int i=0; i < height; i++) {
		free(row_pointers[i]);
	}

	return 0;
}
