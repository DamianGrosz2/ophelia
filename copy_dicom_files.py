#!/usr/bin/env python3
"""
Helper script to copy DICOM files to the backend data directory.
Usage: python copy_dicom_files.py [source_directory]
"""

import os
import shutil
import sys
from pathlib import Path

def copy_dicom_files(source_dir, dest_dir):
    """Copy DICOM files from source to destination directory."""
    
    # Create destination directory if it doesn't exist
    Path(dest_dir).mkdir(parents=True, exist_ok=True)
    
    copied_files = []
    
    for root, dirs, files in os.walk(source_dir):
        for file in files:
            # Check if file looks like a DICOM file
            if (file.lower().endswith(('.dicom', '.dcm')) or 
                file.isdigit() or 
                any(char.isdigit() for char in file)):
                
                source_file = os.path.join(root, file)
                dest_file = os.path.join(dest_dir, file)
                
                # Add .dcm extension if the file doesn't have one
                if not file.lower().endswith(('.dicom', '.dcm')):
                    dest_file += '.dcm'
                
                try:
                    shutil.copy2(source_file, dest_file)
                    copied_files.append(file)
                    print(f"✓ Copied: {file}")
                except Exception as e:
                    print(f"✗ Failed to copy {file}: {e}")
    
    return copied_files

def main():
    # Get the backend data directory
    script_dir = Path(__file__).parent
    backend_data_dir = script_dir / "backend" / "data" / "dicom"
    
    # Get source directory from command line or use current directory
    if len(sys.argv) > 1:
        source_dir = sys.argv[1]
    else:
        source_dir = input("Enter the path to your DICOM files directory: ").strip()
    
    if not os.path.exists(source_dir):
        print(f"❌ Source directory not found: {source_dir}")
        return
    
    print(f"📁 Source: {source_dir}")
    print(f"📁 Destination: {backend_data_dir}")
    print()
    
    copied_files = copy_dicom_files(source_dir, backend_data_dir)
    
    print()
    print(f"🎉 Successfully copied {len(copied_files)} DICOM files!")
    
    if copied_files:
        print("\nCopied files:")
        for file in copied_files[:10]:  # Show first 10 files
            print(f"  • {file}")
        if len(copied_files) > 10:
            print(f"  • ... and {len(copied_files) - 10} more files")
    
    print(f"\n💡 Files are now organized as:")
    print(f"📁 backend/data/")
    print(f"  ├── vtk/          ← VTK 3D models")
    print(f"  └── dicom/        ← DICOM medical images") 
    print("\n🚀 Start your backend server and use the voice assistant to view them!")

if __name__ == "__main__":
    main() 