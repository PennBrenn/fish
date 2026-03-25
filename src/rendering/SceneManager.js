/**
 * SceneManager - Scene graph management and disposal helpers.
 * Imports: Three.js only.
 * Exports: SceneManager class.
 * 
 * Owns the THREE.Scene. Provides disposeObject() helper that recursively
 * traverses children, disposes all geometry and materials, then removes from scene.
 * Per spec: scene.remove() does NOT dispose. Object3D.clear() does NOT dispose.
 */

import * as THREE from 'three';

export default class SceneManager {
  constructor() {
    this._scene = new THREE.Scene();
    this._scene.background = new THREE.Color(0x87ceeb);
  }

  get scene() {
    return this._scene;
  }

  add(object) {
    this._scene.add(object);
  }

  remove(object) {
    this._scene.remove(object);
  }

  /**
   * Recursively dispose all geometry, materials, and textures on an object
   * and all its descendants, then remove it from the scene.
   */
  disposeObject(object) {
    if (!object) return;

    // Traverse all descendants
    object.traverse((child) => {
      // Dispose geometry
      if (child.geometry) {
        child.geometry.dispose();
      }

      // Dispose materials
      if (child.material) {
        if (Array.isArray(child.material)) {
          for (const mat of child.material) {
            this._disposeMaterial(mat);
          }
        } else {
          this._disposeMaterial(child.material);
        }
      }
    });

    // Remove from parent (scene or other object)
    if (object.parent) {
      object.parent.remove(object);
    }
  }

  _disposeMaterial(material) {
    if (!material) return;

    // Dispose all texture properties
    const textureKeys = [
      'map', 'lightMap', 'bumpMap', 'normalMap', 'specularMap',
      'envMap', 'alphaMap', 'aoMap', 'displacementMap',
      'emissiveMap', 'gradientMap', 'metalnessMap', 'roughnessMap',
    ];

    for (const key of textureKeys) {
      if (material[key]) {
        material[key].dispose();
      }
    }

    material.dispose();
  }

  /**
   * Dispose all children of an object (but not the object itself).
   */
  disposeChildren(object) {
    if (!object) return;
    const children = [...object.children];
    for (const child of children) {
      this.disposeObject(child);
    }
  }

  /**
   * Clear the entire scene.
   */
  clear() {
    this.disposeChildren(this._scene);
  }

  dispose() {
    this.clear();
  }
}
