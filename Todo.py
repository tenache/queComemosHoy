# -*- coding: utf-8 -*-
"""
Created on Thu Sep 23 15:21:48 2021

@author: Usuario
"""
import pickle as pkl
class Todo:
    def __init__(self,usuario):
        self.usuario = usuario
        self.comidas = []
        self.guarniciones = []
        self.ingredientes = []
        self.ultimasComidas = []
        self.ultimasGuarniciones = []
    def guardar(self):
        with open(f'{self.usuario}.pkl','wb') as file:
            pkl.dump(self,file)


    def calcularPeso(self):
        self.peso = self.reciente-self.costo+self.salud+self.rico
        for ingrediente in self.ingredientes:
            self.peso += ingrediente.reciente
    def guardar(self,usuario):
        usuario.comidas.append(self)
        usuario.guardar()
    # def guardar(self):
    #     with open(f'{self.nombre}.pkl','wb') as file:
    #         pkl.dump(self,file)
    
            


            
        