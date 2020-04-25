// ==UserScript==
// @id              iitc-plugin-portal-coords-export
// @name            IITC plugin: Portal Coords Export
// @category        Misc
// @version         1
// @namespace       https://gitlab.com/3nvy/ingress-coords-exporter
// @description     Export portals from current view or polygon
// @include         http*://*intel.ingress.com/*
// @match           http*://*intel.ingress.com/*
// @grant           none
// ==/UserScript==

function wrapper(plugin_info) {
  // ensure plugin framework is there, even if iitc is not yet loaded
  if (typeof window.plugin !== "function") window.plugin = function () {};

  window.plugin.multiexport = function () {};

  /*********** MENUE ************************************************************/
  window.plugin.multiexport.createmenu = function () {
    var htmldata =
      "<p> Export from <b> Current View </b> or <b> inside Polygon to CSV Format </p>" +
      "<p> Please note that the first drawn polygon will be choosen to export from. </p>" +
      "<table class='multiexporttabel'> <tr> <th> </th> <th> CSV </th> </tr>" +
      "<tr> <th> Current View </th>" +
      "<td> <a onclick=\"window.plugin.multiexport.export('CSV','VIEW');\" title='Export Current View to CSV'>XXX</a> </td>";
    htmldata += "</tr>";
    if (plugin.drawTools) {
      htmldata +=
        "<tr> <th> Polygon </th>" +
        "<td> <a onclick=\"window.plugin.multiexport.export('CSV','VIEWFIL');\" title='Export Polygon to CSV'>XXX</a> </td>";
      htmldata += "</tr>";
    }

    window.dialog({
      title: "Export Options",
      html: htmldata,
      dialogClass: "ui-dialog-multiExport",
    });
  };

  /*********** HELPER FUNCTION ****************************************************/
  window.plugin.multiexport.portalinpolygon = function (
    portal,
    LatLngsObjectsArray
  ) {
    var portalCoords = portal.split(",");

    var x = portalCoords[0],
      y = portalCoords[1];

    var inside = false;
    for (
      var i = 0, j = LatLngsObjectsArray.length - 1;
      i < LatLngsObjectsArray.length;
      j = i++
    ) {
      var xi = LatLngsObjectsArray[i]["lat"],
        yi = LatLngsObjectsArray[i]["lng"];
      var xj = LatLngsObjectsArray[j]["lat"],
        yj = LatLngsObjectsArray[j]["lng"];

      var intersect =
        yi > y != yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }

    return inside;
  };

  /*********** ABSTRACT EXPORT FUNCTION ******************************************/
  window.plugin.multiexport.export = function (type, source, bkmrkFolder) {
    console.log(type);
    var o = [];
    var portals;
    var sourceTitle;
    var windowTitle;
    if (type === "MF") {
      windowTitle = "Maxfield Export";
    } else {
      windowTitle = type + " Export";
    }
    if (localStorage["plugin-draw-tools-layer"]) {
      var drawLayer = JSON.parse(localStorage["plugin-draw-tools-layer"]);
    }
    if (source == "BKMRK") {
      var bookmarks = JSON.parse(localStorage[plugin.bookmarks.KEY_STORAGE]);
      portals = bookmarks.portals[bkmrkFolder].bkmrk;
    } else {
      portals = window.portals;
    }

    for (var i in portals) {
      var keys = 0;
      var p = window.portals[i];
      var latlng = p._latlng.lat + "," + p._latlng.lng;
      if (source === "VIEWFIL") {
        var portalInPolygon = false;
        for (var dl in drawLayer) {
          if (drawLayer[dl].type === "polygon") {
            if (
              window.plugin.multiexport.portalinpolygon(
                latlng,
                drawLayer[dl].latLngs
              )
            ) {
              portalInPolygon = true;
              break;
            }
          }
        }
        if (!portalInPolygon) {
          continue;
        }
      }

      if (plugin.keys) {
        keys = plugin.keys.keys[i];
      }
      var b = window.map.getBounds();
      // skip if not currently visible
      if (
        p._latlng.lat < b._southWest.lat ||
        p._latlng.lng < b._southWest.lng ||
        p._latlng.lat > b._northEast.lat ||
        p._latlng.lng > b._northEast.lng
      )
        continue;

      var lat = latlng.split(",")[0];
      var lng = latlng.split(",")[1];

      switch (type) {
        case "CSV":
          o.push(lat + "," + lng);
          break;
      }
    }
    var ostr = o.join("\n");

    var dialog = window
      .dialog({
        title: windowTitle,
        dialogClass: "ui-dialog-maxfieldexport",
        html:
          '<textarea readonly id="idmExport" style="width: 600px; height: ' +
          $(window).height() / 3 +
          'px; margin-top: 5px;"></textarea>' +
          "<p><a onclick=\"$('.ui-dialog-maxfieldexport textarea').select();\">Select all</a></p>",
      })
      .parent();

    dialog.css("width", 630).css({
      top: ($(window).height() - dialog.height()) / 2,
      left: ($(window).width() - dialog.width()) / 2,
    });

    $("#idmExport").val(ostr);
  };

  /*********** PLUGIN SETUP *****************************************************/
  // setup function called by IITC
  var setup = function () {
    $("#toolbox").append(
      '<a onclick="window.plugin.multiexport.createmenu();" title="Export the currently visible portals">Export Coords</a>'
    );
    $("head").append(
      "<style>" +
        ".multiExportSetbox > a { display:block; color:#ffce00; border:1px solid #ffce00; padding:3px 0; margin:10px auto; width:100%; text-align:center; background:rgba(8,48,78,.9); }" +
        "table.multiexporttabel { border: 1px solid #ffce00; text-align:center; width: 100%} " +
        "table.multiexporttabel td { border: 1px solid; text-align:center; width: 15%; table-layout: fixed;} " +
        ".ui-dialog-multiExport {width: 400px !important}" +
        "</style>"
    );
  };

  setup.info = plugin_info; //add the script info data to the function as a property
  if (!window.bootPlugins) window.bootPlugins = [];
  window.bootPlugins.push(setup);
  // if IITC has already booted, immediately run the 'setup' function
  if (window.iitcLoaded && typeof setup === "function") setup();
} // wrapper end
// inject code into site context
var script = document.createElement("script");
var info = {};
if (typeof GM_info !== "undefined" && GM_info && GM_info.script)
  info.script = {
    version: GM_info.script.version,
    name: GM_info.script.name,
    description: GM_info.script.description,
  };
script.appendChild(
  document.createTextNode("(" + wrapper + ")(" + JSON.stringify(info) + ");")
);
(document.body || document.head || document.documentElement).appendChild(
  script
);
