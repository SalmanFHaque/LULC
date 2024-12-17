//Map.addLayer(CMA);
Map.setCenter(91.989, 21.438);
Map.setZoom(7);

var bareland = ee.FeatureCollection(bareland01);
var cropland = ee.FeatureCollection(cropland01);
var settlement = ee.FeatureCollection(settlement01);
var vegetation = ee.FeatureCollection(vegetation01);
var waterbody = ee.FeatureCollection(waterbody01);
var landsat = ee.FeatureCollection(landsat01);

//Image Classification 2022
var spatialFiltered = landsat01.filterBounds(CMA);
var temporalFiltered = spatialFiltered.filterDate('2022-01-01', '2022-03-31'); // Temporal Firtering
print('temporalFiltered', temporalFiltered);

var cloud_free = temporalFiltered.filter(ee.Filter.lt('CLOUD_COVER',1)); //Filtering out Cloudy Images 
print('Cloud Free Images',cloud_free);


var sorted = cloud_free.sort('DATE_ACQUIRED'); //Sorting

print('Sorted Cloud Free Images :', sorted);
var img = sorted;
var img2 = cloud_free;

var composite = ee.Algorithms.Landsat.simpleComposite({
  collection: img,
  asFloat: true
}).clip(CMA);

Map.addLayer(composite, {bands: ['B4', 'B3', 'B2'], max: 0.5, gamma: 2},'L8 Image', false);

var nir = composite.select('B5');
var red = composite.select('B4');
var green = composite.select('B3');
var swir = composite.select('B6');

var NDVI = nir.subtract(red).divide(nir.add(red));
//Map.addLayer(NDVI);

var NDWI = green.subtract(swir).divide(green.add(swir));
//Map.addLayer(NDWI);

var bands = ['B1','B2','B3','B4','B5','B6','B7'];
var newfc = bareland.merge(cropland).merge(settlement).merge(vegetation).merge(waterbody);
var label = 'landcover'
var newfc = newfc.randomColumn();

var split = 0.80;
var trainingset = newfc.filter(ee.Filter.lt('random', split));

var validset = newfc.filter(ee.Filter.gte('random', split));

print(newfc);
// Overlay the points on the imagery to get training.
var training = composite.select(bands).sampleRegions({
  collection: trainingset,
  properties: [label],
  scale: 30
});

print(training);
var trained = ee.Classifier.smileRandomForest(5).train(training, label, bands);

// Classify the image with the same bands used for training.
var classified = composite.select(bands).classify(trained);


//Visualization
Map.addLayer(classified,
             {min: 1, max: 5, palette: ['A40606','367E18','F2DEBA','0E5E6F','EDE7B1']},
             'classification');
// Accuracy Assessment
var test = classified.sampleRegions({
  collection: validset,
  properties: [label],
  scale: 30
});

var trainAccuracy = test.errorMatrix('landcover','classification');
print('Resubstitution error matrix: ', trainAccuracy);
print('Training overall accuracy: ', trainAccuracy.accuracy());
print('Training kappa: ', trainAccuracy.kappa());
Export.image.toDrive({
  image: classified,
  description: 'SVM2022',
  scale:30,
  maxPixels: 500000000,
  region: CMA
});
