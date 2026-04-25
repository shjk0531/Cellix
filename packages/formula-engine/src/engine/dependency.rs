use std::collections::{HashMap, HashSet, VecDeque};

pub type CellKey = (String, u32, u32); // (sheet_id, row, col)

pub struct DependencyGraph {
    // A → B means A changed → B must recalculate
    dependents: HashMap<CellKey, HashSet<CellKey>>,
    // B → A means B references A
    dependencies: HashMap<CellKey, HashSet<CellKey>>,
}

impl DependencyGraph {
    pub fn new() -> Self {
        DependencyGraph { dependents: HashMap::new(), dependencies: HashMap::new() }
    }

    pub fn update_deps(&mut self, cell: CellKey, new_deps: HashSet<CellKey>) {
        // Remove old reverse edges
        if let Some(old_deps) = self.dependencies.remove(&cell) {
            for dep in &old_deps {
                if let Some(set) = self.dependents.get_mut(dep) {
                    set.remove(&cell);
                }
            }
        }
        // Add new reverse edges
        for dep in &new_deps {
            self.dependents.entry(dep.clone()).or_default().insert(cell.clone());
        }
        if !new_deps.is_empty() {
            self.dependencies.insert(cell, new_deps);
        }
    }

    pub fn get_dependents(&self, cell: &CellKey) -> Vec<CellKey> {
        self.dependents.get(cell).map(|s| s.iter().cloned().collect()).unwrap_or_default()
    }

    // Returns cells in topological order (dependencies before dependents).
    // Cells forming cycles are omitted from the result; callers should mark them #CYCLE.
    pub fn topological_sort(&self, dirty: HashSet<CellKey>) -> Vec<CellKey> {
        // Expand dirty to transitive dependents via BFS
        let mut all_dirty: HashSet<CellKey> = HashSet::new();
        let mut queue: VecDeque<CellKey> = dirty.into_iter().collect();
        while let Some(cell) = queue.pop_front() {
            if all_dirty.insert(cell.clone()) {
                for dep in self.get_dependents(&cell) {
                    if !all_dirty.contains(&dep) {
                        queue.push_back(dep);
                    }
                }
            }
        }

        // Kahn's algorithm: in-degree counts only edges within all_dirty
        let mut in_degree: HashMap<CellKey, usize> = HashMap::new();
        for cell in &all_dirty {
            let cnt = self.dependencies.get(cell)
                .map(|deps| deps.iter().filter(|d| all_dirty.contains(d)).count())
                .unwrap_or(0);
            in_degree.insert(cell.clone(), cnt);
        }

        let mut queue: VecDeque<CellKey> = in_degree.iter()
            .filter(|(_, &v)| v == 0)
            .map(|(k, _)| k.clone())
            .collect();

        let mut result = Vec::with_capacity(all_dirty.len());
        while let Some(cell) = queue.pop_front() {
            result.push(cell.clone());
            for dep in self.get_dependents(&cell) {
                if all_dirty.contains(&dep) {
                    let cnt = in_degree.entry(dep.clone()).or_insert(0);
                    if *cnt > 0 {
                        *cnt -= 1;
                        if *cnt == 0 {
                            queue.push_back(dep);
                        }
                    }
                }
            }
        }

        result
    }
}
