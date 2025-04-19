const modelMetricMap = {
    "SDFusion": [
      { name: "ULIP Similarity", file: "ULIP_similarity.json", type: "similarity", root: "source/SDFusion/models/ULIP/" },
      { name: "CD Distance", file: "CD_distance.json", type: "distance", root: "source/SDFusion/models/CD/" }
    ],
    "Michelangelo": [
      { name: "ULIP Similarity", file: "ULIP_similarity.json", type: "similarity", root: "source/Michelangelo/models/ULIP/" },
      { name: "CD Distance", file: "CD_distance.json", type: "distance", root: "source/Michelangelo/models/CD/" }
    ]
  };
  
  let currentRoot = "";
  let currentMetricType = "";
  let currentData = {};
  let metadataMap = {};  // key: modelId, value: { category, description }
  
  document.addEventListener("DOMContentLoaded", () => {
    const modelSelect = document.getElementById("modelSelect");
    const metricSelect = document.getElementById("metricSelect");
  
    // Populate metric dropdown
    function populateMetrics(modelName) {
      metricSelect.innerHTML = "";
      modelMetricMap[modelName].forEach(m => {
        const opt = document.createElement("option");
        opt.value = m.file;
        opt.text = m.name;
        metricSelect.appendChild(opt);
      });
    }
  
    // ✅ Proper CSV parsing using PapaParse
    async function loadMetadataCSV(modelName) {
      metadataMap = {};
  
      const path = modelName === "SDFusion"
        ? "source/SDFusion/data/sampled_metadata.csv"
        : "source/Michelangelo/data/sampled_metadata.csv";
  
      const response = await fetch(path);
      const text = await response.text();
  
      const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
  
      for (const row of parsed.data) {
        const modelId = row["modelId"];
        const description = row["description"];
        const category = row["category"];
        if (modelId && description) {
          metadataMap[modelId] = { description, category };
        }
      }
    }
  
    modelSelect.addEventListener("change", async () => {
      populateMetrics(modelSelect.value);
      await loadMetadataCSV(modelSelect.value);
      loadAndPlot();
    });
  
    metricSelect.addEventListener("change", loadAndPlot);
  
    // Initial load
    populateMetrics(modelSelect.value);
    loadMetadataCSV(modelSelect.value).then(loadAndPlot);
  
    async function loadAndPlot() {
      const modelName = modelSelect.value;
      const metricFile = metricSelect.value;
      const metricInfo = modelMetricMap[modelName].find(m => m.file === metricFile);
      currentRoot = metricInfo.root;
      currentMetricType = metricInfo.type;
  
      const res = await fetch(`source/${modelName}/data/${metricFile}`);
      currentData = await res.json();
  
      let entries = Object.entries(currentData).map(([genId, meta]) => {
        const metaInfo = metadataMap[genId] || { category: "unknown", description: "N/A" };
        return {
          metric: meta[metricInfo.type],
          generatedId: genId,
          refId: meta.ref_modelId,
          category: metaInfo.category,
          description: metaInfo.description
        };
      });
  
      entries.sort((a, b) => {
        return metricInfo.type === "similarity" ? b.metric - a.metric : a.metric - b.metric;
      });
  
      const categories = [...new Set(entries.map(e => e.category))];
      const categoryColorMap = {};
      categories.forEach((cat, idx) => {
        categoryColorMap[cat] = idx;
      });
  
      const trace = {
        x: entries.map((_, i) => i),
        y: entries.map(e => e.metric),
        text: entries.map(e =>
          `Category: ${e.category}<br>Description: ${e.description}`
        ),
        customdata: entries.map(e => [e.generatedId, e.refId, e.description]),
        mode: "markers",
        type: "scatter",
        marker: {
          size: 10,
          color: entries.map(e => categoryColorMap[e.category]),
          colorscale: "Category10",
          showscale: false
        },
        hovertemplate:
          "Index: %{x}<br>" +
          metricInfo.type + ": %{y:.4f}<br>" +
          "%{text}<extra></extra>"
      };
  
      const layout = {
        title: {
          text: `${metricInfo.name} (${modelName})`,
          font: { size: 20 }
        },
        margin: { t: 60, l: 50, r: 30, b: 50 },
        xaxis: { title: "Sorted Index" },
        yaxis: { title: metricInfo.type },
        plot_bgcolor: "#f9f9f9",
        paper_bgcolor: "#f5f5f5"
      };
  
      Plotly.newPlot("plot", [trace], layout, { responsive: true });
  
      document.getElementById("viewer-container").innerHTML = "";
      document.getElementById("plot").on("plotly_click", onPointClick);
    }
  
    function onPointClick(data) {
      const [genId, refId, description] = data.points[0].customdata;
  
      const genPath = `${currentRoot}${genId}/generated/points_normalize.ply`;
      const refPath = `${currentRoot}${genId}/rank_1/points_normalize.ply`;
  
      const genViewer = `<div><h4>Generated</h4><iframe src="assets/viewer.html?model=${genPath}"></iframe></div>`;
      const refViewer = `<div><h4>Reference</h4><iframe src="assets/viewer.html?model=${refPath}"></iframe></div>`;
      const prompt = `<div style="width:100%;margin-top:10px;"><strong>Prompt:</strong> ${description}</div>`;
  
      document.getElementById("viewer-container").innerHTML = genViewer + refViewer + prompt;
    }
  });