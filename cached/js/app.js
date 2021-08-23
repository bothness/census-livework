// Declare constants/variables
const centroidsurl = './src/centroids.tsv';

// Identify elements for event listeners + DOM rendering
const searchbox = document.getElementById('searchbox');
const searchbutton = document.getElementById('searchbutton');
const searchtype = document.getElementById('searchtype');
const results = document.getElementById('results');
const loader = document.getElementById('loader');

// Set data for origin and destination
const origin = {
  'query1': 'currently_residing_in',
  'query2': 'place_of_work',
  'code': 'place_of_work_code',
  'name': 'place_of_work_name'
}
const destination = {
  'query1': 'place_of_work',
  'query2': 'currently_residing_in',
  'code': 'currently_residing_in_code',
  'name': 'currently_residing_in_name'
}
var selectedsearch = origin;

// Blank arrays for json data etc
var json = {};
var geojson = {};
var geolines = {};
var centroids = {};
var selected = '';

// Function to convert URL to cache url
function cacheURL(url) {
  const base = "https://ahmadb12.sg-host.com/?url=";
  return base + encodeURIComponent(url);
}

// Function to update geojson polygon layer
function addPolygonLayer(geodata, layername) {
  map.addSource(layername, {
    'type': 'geojson',
    'data': geodata
  });
  map.addLayer({
    'id': layername,
    'type': 'line',
    'source': layername,
    'layout': {},
    'paint': {
      'line-width': 2,
      'line-color': '#b00',
      'line-opacity': 0.8
    }
  });
}

// Function to update geojson lines layer
function addLineLayer(geodata, layername) {
  map.addSource(layername, {
    'type': 'geojson',
    'data': geodata
  });
  map.addLayer({
    'id': layername,
    'type': 'line',
    'source': layername,
    'layout': {},
    'paint': {
      'line-width': ['get', 'width'],
      'line-color': '#088',
      'line-opacity': 0.8
    }
  });
  // Add tooltips on hover
  map.on('mouseenter', layername, function (e) {
    // Change the cursor style as a UI indicator.
    map.getCanvas().style.cursor = 'pointer';

    var persons = e.features[0].properties.size > 1 ? 'people' : 'person';
    var description = '<strong>' + e.features[0].properties.name + '</strong><br>' + e.features[0].properties.size + ' ' + persons;

    // Populate the popup and set its coordinates
    // based on the feature found.
    popup
      .setLngLat(e.lngLat)
      .setHTML(description)
      .addTo(map);
  });

  // Remove tooltips on mouseleave
  map.on('mouseleave', layername, function (e) {
    map.getCanvas().style.cursor = '';
    popup.remove();
  });
}

// Function to remove a layer + source (if it exists)
function remMapLayer(layer) {
  if (map.getLayer(layer)) {
    map.removeLayer(layer);
  }
  if (map.getSource(layer)) {
    map.removeSource(layer);
  }
}

// Function to fit map to geojson layer
function fitMapLayer(geodata) {
  var coordinates = geodata.features[0].geometry.geometries ? geodata.features[0].geometry.geometries[0].coordinates[0] : geodata.features[0].geometry.coordinates[0];

  var bounds = coordinates.reduce(function (bounds, coord) {
    return bounds.extend(coord);
  }, new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]));

  map.fitBounds(bounds, {
    padding: 300
  });
}

// Function to zoom to selected feature
function zoomToFeature(selected) {
  map.flyTo({
    center: [selected.lng, selected.lat],
    zoom: 10,
    bearing: 0,
    pitch: 0
    });
}

// Function to turn CSV (string) into array of objects
function tsv2json(string) {
  let json = [];
  string = string.replace(/['"]+/g, '');
  let array = string.split('\n');
  let headers = array[0].split('\t');
  for (var i = 1; i < array.length; i++) {
    if (array[i] != '') {
      let data = array[i].split('\t');
      let obj = {};
      for (var j = 0; j < data.length; j++) {
        obj[headers[j].trim()] = data[j].trim();
      }
      json.push(obj);
    }
  }
  return json;
}

// Function to transform json into indexed format
function json2list(json) {
  let list = {};
  for (item in json) {
    list[json[item]['code']] = {
      "name": json[item].name,
      "lat": parseFloat(json[item].lat),
      "lng": parseFloat(json[item].lng)
    }
  }
  return list;
}

// Function to remove zero value rows from places array
function remZero(array) {
  let newarray = [];
  for (item in array) {
    let temp = array[item];
    temp['OBS_VALUE'] = parseInt(temp['OBS_VALUE']);
    if (temp['OBS_VALUE'] > 0) {
      newarray.push(temp);
    }
  }
  return newarray;
}

// Function to sum total number of people
function sumPeople(geodata) {
  let count = 0;
  for (item in geodata.features) {
    count += geodata.features[item].properties.size;
  }
  return count;
}

// Function to update results text
function updateText(selected, selectedsearch, count) {
  let text = '';
  if (selectedsearch == origin) {
    text = 'Places of work for ' + count + ' people living in ' + selected.name + '.';
  } else {
    text = 'Places of residence for ' + count + ' people working in ' + selected.name + '.';
  }
  results.innerHTML = text;
}

// Function to create geojson multiline string of connections
function json2geolines(json, selected, selectedsearch, coords, id) {
  var geojson = {
    "type": "FeatureCollection",
    "id": id, "features": []
  };
  for (item in json) {
    let size = json[item]['OBS_VALUE'];
    let width = size >= 500 ? 16 : size >= 100 ? 8 : size >= 20 ? 4 : size >= 5 ? 2 : 1;
    let feature = {
      "type": "Feature",
      "geometry": {
        "type": "LineString",
        "coordinates": [
          [selected.lng, selected.lat],
          [coords[json[item][selectedsearch.code.toUpperCase()]].lng, coords[json[item][selectedsearch.code.toUpperCase()]].lat]
        ]
      },
      "properties": {
        "code": json[item][selectedsearch.code.toUpperCase()],
        "name": json[item][selectedsearch.name.toUpperCase()],
        "size": size,
        "width": width
      }
    }
    geojson.features.push(feature);
  };
  return geojson;
}

// Function to convert objects to geojson format
function json2geo(json, id) {
  var keys = Object.keys(json[0]);
  var geojson = { "type": "FeatureCollection", "id": id, "features": [] };
  for (item in json) {
    var feature = {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [parseFloat(json[item].lng), parseFloat(json[item].lat)]
      },
      "properties": {}
    };
    for (key in keys) {
      if (keys[key] != "lat" && keys[key] != "lng") {
        feature.properties[keys[key]] = json[item][keys[key]];
      }
    }

    geojson.features.push(feature);
  };
  return geojson;
}

// Function to create data table from json data
function data2table(data) {
  let keys = Object.keys(data[0]);
  let html = '<p>Age breakdown for the population of output area ' + data[0]['GEOGRAPHY_CODE'] + ' in ' + data[0]['DATE_NAME'] + '.</p>';
  html += '<table class="table table-sm">';
  html += '<thead><tr><th scope="col">Age group</th><th scope="col">%</th></tr></thead><tbody>'
  for (object in data) {
    html += '<tr>';
    html += '<td>' + data[object][keys[2]] + '</td>';
    html += '<td><img src="./img/pixel.png" style="height: 18px; width: ' + (data[object][keys[3]] * 4) + 'px;"> ' + data[object][keys[3]] + '%</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  results.innerHTML = html;
}

// function to return output area data based on postcode or coordinates
function search(type, value) {
  loader.style.display = 'flex';
  let tsvurl = '';
  let kmlurl = '';
  let uid = '&uid=0x3cfb19ead752b37bb90da0eb3a0fe78baa9fa055';
  if (type == 'postcode') {
    kmlurl = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_145_1.data.kml?date=latest&geography=POSTCODE|' + value + ';297&rural_urban=0&cell=0&measures=20100' + uid;
  } else {
    kmlurl = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_145_1.data.kml?date=latest&geography=LATLONG|' + value.lat + ';' + value.lng + ';297&rural_urban=0&cell=0&measures=20100' + uid;
  }

  fetch(kmlurl).then((response) => {
    return response.text();
  })
    .then((str) => {
      return (new window.DOMParser()).parseFromString(str, "text/xml");
    })
    .then((kmldata) => {
      geojson = toGeoJSON.kml(kmldata);
      return geojson;
    })
    .then((geodata) => {
      if (geodata.features[0]) {
        let code = geodata.features[0].properties.name;
        selectedsearch = searchtype.value == 'residence' ? origin : destination;
        selected = {
          "code": code,
          "name": centroids[code].name,
          "lat": centroids[code].lat,
          "lng": centroids[code].lng
        };
        tsvurl = 'https://www.nomisweb.co.uk/api/v01/dataset/NM_1228_1.data.tsv?date=latest&' + selectedsearch.query1 + '=' + selected.code + '&' + selectedsearch.query2 + '=1245708289...1245715489&measures=20100&select=' + selectedsearch.code + ',' + selectedsearch.name + ',obs_value';

        fetch(cacheURL(tsvurl)).then((response) => {
          return response.text();
        })
          .then((tsvdata) => {
            return tsv2json(tsvdata);
          })
          .then((jsondata) => {
            json = remZero(jsondata);
            return json;
          })
          .then((jsondata) => {
            geolines = json2geolines(jsondata, selected, selectedsearch, centroids, 'lines');
            return true;
          })
          .then(() => {
            let sum = sumPeople(geolines);
            updateText(selected, selectedsearch, sum);
            remMapLayer('lines');
            addLineLayer(geolines, 'lines');
            remMapLayer('selection');
            addPolygonLayer(geojson, 'selection');
            loader.style.display = 'none';
            zoomToFeature(selected);
          });
      } else {
        results.innerHTML = 'Invalid search. Please try again.';
        loader.style.display = 'none';
      }
      return true;
    });
}

// Initialize map
mapboxgl.accessToken = 'pk.eyJ1IjoiYXJrYmFyY2xheSIsImEiOiJjamdxeDF3ZXMzN2IyMnFyd3EwdGcwMDVxIn0.P2bkpp8HGNeY3-FOsxXVvA';
var map = new mapboxgl.Map({
  container: 'map',
  style: {
    'version': 8,
    'sources': {
      'osm-tiles': {
        'type': 'raster',
        'tiles': [
          'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
        ],
        'tileSize': 256,
        'attribution':
          'Data: <a href="https://www.nomisweb.co.uk/census/2011/wf01bew" target="_blank">Nomis/ONS</a>. Basemap: <a href="https://openstreetmap.org" target="_blank">OpenStreetMap</a>'
      }
    },
    'layers': [
      {
        'id': 'osm-tiles',
        'type': 'raster',
        'source': 'osm-tiles',
        'minzoom': 0,
        'maxzoom': 20
      }
    ]
  },
  center: [-4, 54.5],
  zoom: 5,
  maxZoom: 20,
  minZoom: 4
});
map.addControl(new mapboxgl.NavigationControl());

// Create popup class for map tooltips
var popup = new mapboxgl.Popup({
  closeButton: false,
  closeOnClick: false
});

// Update map on click
map.on('click', function (e) {
  search('coords', e.lngLat);
});

// Load centroids for super output areas
fetch(centroidsurl).then((response) => {
  return response.text();
})
  .then((tsvdata) => {
    return tsv2json(tsvdata);
  })
  .then((jsondata) => {
    centroids = json2list(jsondata);
    loader.style.display = 'none';
    return true;
  });

// Add event listeners for search
searchbox.addEventListener('change', () => { search('postcode', searchbox.value) });
searchbutton.addEventListener('click', () => { search('postcode', searchbox.value) });