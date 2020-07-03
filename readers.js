import {STLLoader} from './node_modules/three/examples/jsm/loaders/STLLoader.js';
import * as THREE from './node_modules/three/build/three.module.js';


function code_to_char (utf_code) {
  return String.fromCharCode(utf_code);
};

function slice_arr_buff(arr_buff, start, end) {
  let slice = "";
  for(let pos = start; pos < end; ++pos) {
    slice += code_to_char(arr_buff[pos]);
  }
  return slice;
};

class PTLoader {
  constructor() {
    this.parse = function (file_arr) {
  		let geometry = new THREE.BufferGeometry();

      let curr_pos = 0;
      let prev_pos = 0;
      let curr_char = null;
      let char_arr = [];
      let temp_delim = [','];
      let point_delim = ['\n'];

      while(curr_pos <= file_arr.length) {

        if(curr_pos < file_arr.length) {curr_char = code_to_char(file_arr[curr_pos]);}

        if(curr_pos < file_arr.length && !temp_delim.includes(curr_char)
        && !point_delim.includes(curr_char)) {++curr_pos; continue;}

        let entry = Number(slice_arr_buff(file_arr, prev_pos, curr_pos));

        char_arr.push(entry);

        while(temp_delim.includes(curr_char) && curr_pos < file_arr.length) {
          curr_char = code_to_char(file_arr[++curr_pos]);
        }

        prev_pos = curr_pos;
        ++curr_pos;
     }


  		if(char_arr.length == 0) { return geometry; }
  		if(char_arr[char_arr.length - 1] == "") {char_arr.pop();}

      let vertices = new Float32Array(char_arr);
  		geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

      return geometry;
  	}
  }
}

export class GeometryParser extends FileReader {
  constructor(scene, vertex_data, object,
              color, position, alpha,
              temp_reader, output_writer,
              output_link) {
    super();

    let stl_loader = new STLLoader();
    let pt_loader = new PTLoader();
    let loaded = false;

    this._is_stl = null;

    this.onload = function (e) {

  			if(this._is_stl) {
  				object.geometry = stl_loader.parse(e.target.result);
  				object.material = new THREE.MeshBasicMaterial(
  					{ vertexColors: THREE.VertexColors }
  				);
  			}

  			else {
          let file_arr = new Uint8Array(e.target.result);
  				object.geometry = pt_loader.parse(file_arr);
  				object.material = new THREE.ShaderMaterial(
  					{
              uniforms : { pt_size: {value: 1.0} },
              vertexShader:   document.getElementById( 'vertexshader' ).textContent,
              fragmentShader: document.getElementById( 'fragmentshader' ).textContent,
              transparent:    true
            }
  				);
  			}

  			let colors = new Float32Array(object.geometry.attributes.position.array.length);
        let alphas = new Float32Array(object.geometry.attributes.position.array.length/3);
        for(let i = 0; i < alphas.length; ++i) {alphas[i] = 1;}

  			object.geometry.setAttribute('color',  new THREE.Float32BufferAttribute( colors, 3 ) );
        object.geometry.setAttribute('alpha',  new THREE.Float32BufferAttribute( alphas, 1 ) );

  			object.geometry.center();

  			if(this._is_stl) {scene.add(new THREE.Mesh(object.geometry, object.material));}
  			else {scene.add(new THREE.Points(object.geometry, object.material));}

        color.attribute = object.geometry.attributes.color;
        position.attribute = object.geometry.attributes.position;
        alpha.attribute = object.geometry.attributes.alpha;

        temp_reader.parser = new TempParser(color.attribute.array, position.attribute.array,
                                            vertex_data, output_writer, output_link);

  	}

  }

  set is_stl(file_type) {
    this._is_stl = file_type;
  }
}


export class TempParser extends FileReader {
  constructor(color_array, position_array, vertex_data,
              output_writer, output_link) {

    super();

    this.onload = function (e) {
      // http://updates.html5rocks.com/2012/06/How-to-convert-ArrayBuffer-to-and-from-String
      let file_arr = new Uint8Array(e.target.result);
      parse_csv(file_arr, color_array.length/3);
      output_writer.writer = new OutputWriter(position_array, vertex_data, output_link);
      output_writer.loaded = true;
    };

		function parse_csv (file_arr, num_pts) {
			parse(file_arr, [','], ['\n'], num_pts);
 	 	};

    function parse (file_arr, temp_delim, point_delim, num_pts) {
			 let idx = 0;
			 let num_frames = 0;
       let first_line_char = code_to_char(file_arr[idx]);

			 while(idx < file_arr.length && !point_delim.includes(first_line_char)) {
				 if(temp_delim.includes(first_line_char)) { ++num_frames; }
         first_line_char = code_to_char(file_arr[++idx]);
			 }

			 if(num_frames == 0) { return; }

       first_line_char = code_to_char(file_arr[idx - 1]);

			 num_frames += (!temp_delim.includes(first_line_char));

       vertex_data.frames_per_pt = num_frames;
			 vertex_data.frames = new Float32Array(num_frames*num_pts);
			 vertex_data.means = new Float32Array(num_pts);
			 vertex_data.maxima = new Float32Array(num_pts);
			 vertex_data.minima = new Float32Array(num_pts);
       vertex_data.range = new Float32Array(num_pts);
			 vertex_data.std_dev = new Float32Array(num_pts);

			 let curr_pos = 0;
			 let prev_pos = 0;
       let curr_char = null;
			 let frame = 0;

			 let buffer = new Float32Array(num_frames);
			 let buffer_mean = 0;
			 let buffer_min = Infinity;
			 let buffer_max = -Infinity;
			 let buff_frame = 0;
			 let pt = 0;

				while(curr_pos <= file_arr.length) {

          if(curr_pos < file_arr.length) {curr_char = code_to_char(file_arr[curr_pos]);}

					if(curr_pos < file_arr.length && !temp_delim.includes(curr_char)
          && !point_delim.includes(curr_char)) {++curr_pos; continue;}

					let entry = Number(slice_arr_buff(file_arr, prev_pos, curr_pos));

					vertex_data.frames[frame++] = entry;

          if(entry == entry) {
            if(entry < buffer_min) { buffer_min = entry; }
  					if(entry > buffer_max) { buffer_max = entry; }
            buffer[buff_frame++] = entry;
            buffer_mean += entry/vertex_data.frames_per_pt;
          }

					if(point_delim.includes(curr_char) || buff_frame == vertex_data.num_temps) {

						 vertex_data.means[pt] = buffer_mean;
						 vertex_data.minima[pt] = buffer_min;
						 vertex_data.maxima[pt] = buffer_max;
             vertex_data.range[pt] = buffer_max - buffer_min;

			 			 let variance = 0;
			 			 for(let j = 0; j < buffer.length; ++j) {
							 variance += ( (buffer[j] - buffer_mean)*
                             (buffer[j] - buffer_mean)/buffer.length );
			 			 }
						 vertex_data.std_dev[pt++] = Math.sqrt(variance);

						 buffer_mean = 0;
						 buffer_min = Infinity;
						 buffer_max = -Infinity;
						 buff_frame = 0;

					}

					while(temp_delim.includes(curr_char) && curr_pos < file_arr.length) {
            curr_char = code_to_char(file_arr[++curr_pos]);
          }

					prev_pos = curr_pos;
					++curr_pos;
			 }
       console.log(vertex_data);
	  };


  }

}

export class OutputWriter {
  constructor(position_array, vertex_data, output_link) {

    this.generate_link = function () {
      const file_blob = new Blob([format_data(position_array, vertex_data)],
                                 {type:'text/plain'});
      if(output_link !== null) {
        window.URL.revokeObjectURL(output_link);
      }
      return window.URL.createObjectURL(file_blob);
    }

    function format_data(position_array, vertex_data) {
      let file_text = '';
      for(let i = 0; i + 2 < position_array.length; i += 3) {
			 // add point coordinates
			 let x = position_array[i];
			 let y = position_array[i+1];
			 let z = position_array[i+2];
			 file_text += `${x} ${y} ${z}\n`;

			 // calculate mean, minimum, maximum of temp buffer
			 let max = vertex_data.maxima[i/3];
			 let min = vertex_data.minima[i/3];
			 let mean = vertex_data.means[i/3];
			 let std_dev = vertex_data.std_dev[i/3];

			 // format constants into the file text
			 file_text += `Max: ${max}\nMin: ${min}\nMean: ${mean}\nStandard Deviation: ${std_dev}\n`;
		 }
     return file_text;
   }
  }
}
